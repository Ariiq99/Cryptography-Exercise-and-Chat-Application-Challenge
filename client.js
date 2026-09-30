const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let targetUsername = "";
let username = "";
const users = new Map(); // Map menyimpan publicKey milik pengguna lain

// 1. Generate Pasangan Kunci RSA (Public Key & Private Key)
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Fungsi Enkripsi Pesan menggunakan Public Key milik Target
function encryptMessage(message, targetPublicKey) {
  try {
    const bufferMessage = Buffer.from(message, "utf8");
    const encryptedBuffer = crypto.publicEncrypt(targetPublicKey, bufferMessage);
    return encryptedBuffer.toString("base64");
  } catch (error) {
    console.log("Encryption failed:", error.message);
    return null;
  }
}

// Fungsi Deskripsi Pesan menggunakan Private Key milik Sendiri
function decryptMessage(ciphertextBase64, privateKey) {
  try {
    const bufferCiphertext = Buffer.from(ciphertextBase64, "base64");
    const decryptedBuffer = crypto.privateDecrypt(privateKey, bufferCiphertext);
    return decryptedBuffer.toString("utf8");
  } catch (error) {
    return null; // Gagal deskripsi (bukan penerima yang sah)
  }
}

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input;
    console.log(`Welcome, ${username} to the chat`);

    // Registrasi Public Key asli ke server
    socket.emit("registerPublicKey", {
      username: username,
      publicKey: publicKey,
    });

    rl.prompt();

    rl.on("line", (message) => {
      const trimmedMsg = message.trim();
      if (trimmedMsg) {
        // Handling perintah !secret <username>
        const match = trimmedMsg.match(/^!secret (\w+)$/);
        if (match) {
          targetUsername = match[1];
          console.log(`Now secretly chatting with ${targetUsername}`);
        } 
        // Handling perintah !exit (keluar dari secret chat)
        else if (trimmedMsg.match(/^!exit$/)) {
          console.log(`No more secretly chatting with ${targetUsername}`);
          targetUsername = "";
        } 
        // Pengiriman Pesan
        else {
          if (targetUsername) {
            // Mode Secret Chat: Cari public key dari targetUsername
            const targetPublicKey = users.get(targetUsername);

            if (!targetPublicKey) {
              console.log(`User '${targetUsername}' not found or has no public key!`);
            } else {
              // Enkripsi pesan dengan Public Key milik Target
              const encryptedMsg = encryptMessage(trimmedMsg, targetPublicKey);
              if (encryptedMsg) {
                socket.emit("message", {
                  username,
                  message: encryptedMsg,
                  targetUsername,
                });
              }
            }
          } else {
            // Mode Chat Publik (Unencrypted)
            socket.emit("message", {
              username,
              message: trimmedMsg,
              targetUsername: "",
            });
          }
        }
      }
      rl.prompt();
    });
  });
});

// Terima inisialisasi user & public key dari server
socket.on("init", (keys) => {
  keys.forEach(([user, key]) => users.set(user, key));
  console.log(`\nThere are currently ${users.size} users in the chat`);
  rl.prompt();
});

// Terima data pengguna baru
socket.on("newUser", (data) => {
  const { username: newUsername, publicKey: newPublicKey } = data;
  users.set(newUsername, newPublicKey);
  if (newUsername !== username) {
    console.log(`${newUsername} joined the chat`);
  }
  rl.prompt();
});

// Penerimaan Pesan dari Server
socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage, targetUsername: msgTarget } = data;

  // Tampilkan hanya jika pesan bukan berasal dari diri sendiri
  if (senderUsername !== username) {
    // Jika pesan ini ditujukan khusus sebagai Secret Message
    if (msgTarget) {
      if (msgTarget === username) {
        // Saya adalah Target Pesan: Deskripsi menggunakan Private Key milik saya
        const decryptedText = decryptMessage(senderMessage, privateKey);
        if (decryptedText) {
          console.log(`[Secret from ${senderUsername}]: ${decryptedText}`);
        } else {
          console.log(`[Secret from ${senderUsername}]: Failed to decrypt message.`);
        }
      } else {
        // Saya adalah Eavesdropper (Bukan Target): Tampilkan Ciphertext (Gibberish)
        console.log(`[Secret ${senderUsername} -> ${msgTarget}]: ${senderMessage}`);
      }
    } else {
      // Pesan Publik Biasa
      console.log(`${senderUsername}: ${senderMessage}`);
    }
    rl.prompt();
  }
});

socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});