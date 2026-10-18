import express from 'express';
import cors from 'cors';
import moduleRoutes from './routes/routes.js';
import sectionRoutes from './routes/sections.js';


const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN }));  // e.g. http://localhost:5173
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/modules', moduleRoutes);

app.use('/api/sections', sectionRoutes);

// Catches errors thrown in any route
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;