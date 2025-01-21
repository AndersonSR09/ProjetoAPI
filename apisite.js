const { app } = require('@azure/functions');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');

// Configuração do Azure Blob Storage com a chave diretamente no código
const blobServiceClient = BlobServiceClient.fromConnectionString('chave de acesso');
const containerClient = blobServiceClient.getContainerClient('');  // Nome do contêiner no Blob Storage

// Configuração do Azure Cosmos DB com a chave diretamente no código
const cosmosClient = new CosmosClient({
    endpoint: 'https://seu-cosmos-db-uri',  // URI do seu Cosmos DB
    key: 'sua-cosmos-db-key'  // Chave do seu Cosmos DB
});
const database = cosmosClient.database('dbsite');  // Nome do banco de dados 'dbsite'
const container = database.container('videos');  // Nome do contêiner no Cosmos DB

// Configuração do Multer para lidar com o upload de arquivos binários
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.http('projetoapi', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        if (request.method === 'POST') {
            // Usar multer para processar o upload de arquivos
            const formData = await new Promise((resolve, reject) => {
                upload.single('file')(request, {}, (err) => {
                    if (err) reject(err);
                    else resolve(request.file);
                });
            });

            if (!formData) {
                return { status: 400, body: 'Nenhum arquivo enviado.' };
            }

            const blobName = `video-${Date.now()}`;  // Nome do blob
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            try {
                // Upload do arquivo para o Azure Blob Storage
                await blockBlobClient.upload(formData.buffer, formData.buffer.length);

                // Salvar metadados no Azure Cosmos DB
                const videoMetadata = {
                    id: blobName,
                    name: formData.originalname,
                    url: blockBlobClient.url,
                    uploadDate: new Date()
                };
                await container.items.create(videoMetadata);

                return { body: `Upload realizado com sucesso! URL: ${blockBlobClient.url}` };
            } catch (error) {
                context.log(`Erro ao fazer upload: ${error.message}`);
                return { status: 500, body: 'Erro ao fazer upload do arquivo.' };
            }
        }

        return { body: `Método não suportado` };
    }
});
