const express = require('express');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const { Readable } = require('stream');
const cluster = require('cluster');
const os = require('os');
require('dotenv').config();

const app = express();
//app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient('testingstorage1240');

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const blobName = req.file.originalname;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await containerClient.createIfNotExists();

        const readableStream = Readable.from(req.file.buffer);
        const uploadBlobResponse = await blockBlobClient.uploadStream(readableStream, 4 * 1024 * 1024, 5, {
            blobHTTPHeaders: { blobContentType: req.file.mimetype }
        });

        res.status(200).send(`File uploaded successfully. Blob URL: ${blockBlobClient.url}`);
    } catch (error) {
        res.status(500).send('Error uploading file: ' + error.message);
    }
});
app.get('/',(req,res)=>{
    res.send(`
        <h2>File Upload</h2>
        <form action="/upload" method="POST" enctype="multipart/form-data">
            <input type="file" name="file" />
            <input type="submit" value="Upload" />
        </form>
    `);
    
})
function startServer() {
    app.listen(process.env.PORT || 3000, () => {
        console.log(`Server running on port 3000`);
    });
}

if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(`Master ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
    });
} else {
    startServer();
}
