const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const pdfInput = document.getElementById('pdf-input');
const uploadBtn = document.getElementById('upload-btn');
const fileNameDisplay = document.getElementById('file-name');
const uploadStatus = document.getElementById('upload-status');
const typingIndicator = document.getElementById('typing-indicator');

let currentPdfId = null;

// Tampilkan nama file saat dipilih
pdfInput.addEventListener('change', function() {
    fileNameDisplay.textContent = this.files[0] ? this.files[0].name : 'Pilih laporan (.pdf)';
});

function appendMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-content">${text}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv.querySelector('.message-content');
}

// Handler Upload PDF
uploadBtn.addEventListener('click', async () => {
    if (!pdfInput.files[0]) {
        alert("Pilih file PDF terlebih dahulu!");
        return;
    }

    uploadStatus.textContent = "Sedang menganalisa dokumen...";
    uploadStatus.style.color = "var(--primary)";
    
    const formData = new FormData();
    formData.append('pdf', pdfInput.files[0]);

    try {
        const res = await fetch('/upload-pdf', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        
        if (data.id) {
            currentPdfId = data.id;
            uploadStatus.textContent = "Dokumen siap dianalisa secara mendalam.";
            uploadStatus.style.color = "#22c55e";
            appendMessage('bot', `Saya telah selesai membaca dokumen **${pdfInput.files[0].name}**. Silakan ajukan pertanyaan terkait isi dokumen tersebut.`);
        } else {
            throw new Error(data.error || "Gagal upload");
        }
    } catch (err) {
        uploadStatus.textContent = "Gagal memproses dokumen: " + err.message;
        uploadStatus.style.color = "#ef4444";
    }
});

chatForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  appendMessage('user', message);
  userInput.value = '';

  // Tampilkan indikator mengetik
  typingIndicator.style.display = 'flex';
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const response = await fetch('/reading-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        chat: [{ role: 'user', text: message }], 
        pdfId: currentPdfId 
      }),
    });

    if (!response.ok) throw new Error('Koneksi server terputus');

    const data = await response.json();
    
    // Sembunyikan indikator mengetik sebelum menampilkan pesan
    typingIndicator.style.display = 'none';
    
    appendMessage('bot', data.text || 'Maaf, saya tidak menemukan jawaban yang relevan dalam dokumen.');
    
  } catch (error) {
    console.error('Error:', error);
    typingIndicator.style.display = 'none';
    appendMessage('bot', 'Terjadi gangguan teknis saat menghubungi sistem.');
  }
});
