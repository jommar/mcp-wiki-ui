import express from 'express';
import cors from 'cors';
import wikiRoutes from './routes/wiki.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/wiki', wikiRoutes);

app.listen(PORT, () => console.log(`Wiki API → http://localhost:${PORT}`));
