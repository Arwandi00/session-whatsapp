import makeWASocket from '@adiwajshing/baileys';
import { useMultiFileAuthState } from '@adiwajshing/baileys';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Function to read the pairing number from the user
const readPairingNumber = () => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Please enter the client number for pairing: ', (number) => {
            rl.close();
            resolve(number);
        });
    });
};

async function startSession() {
    const sessionPath = './session';
    const backupPath = './session_backup';

    if (fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length === 0) {
        console.log('Folder session utama kosong. Menyalin creds.json dari session backup...');
        const sessionBackupFolder = fs.readdirSync(backupPath).find(folder => fs.existsSync(path.join(backupPath, folder, 'creds.json')));
        if (sessionBackupFolder) {
            fs.copyFileSync(path.join(backupPath, sessionBackupFolder, 'creds.json'), path.join(sessionPath, 'creds.json'));
            console.log('creds.json berhasil disalin ke folder session utama.');
        } else {
            console.log('creds.json tidak ditemukan di session backup.');
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const client = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    if (!client.authState.creds.registered) {
        const number = await readPairingNumber();
        const code = await client.requestPairingCode(number);
        console.log(`Pairing code for ${number}: ${code}`);
    }

    client.ev.on('creds.update', saveCreds);

    client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            console.error('Koneksi terputus, alasan:', reason);

            if (reason === DisconnectReason.connectionClosed) {
                console.log('Koneksi tertutup. Menyalin session backup ke session utama...');
                if (fs.existsSync(backupPath)) {
                    copyFolderSync(backupPath, sessionPath);
                    console.log('Penyalinan selesai. Mencoba restart bot...');
                } else {
                    console.error('Session backup tidak ditemukan. Tidak bisa menyalin.');
                }
                setTimeout(() => {
                    startSession().catch(err => console.error('Gagal restart bot:', err));
                }, 3000);
            }
        }
    });

    return client;
}

startSession().catch(err => console.error('Error saat memulai session:', err));
