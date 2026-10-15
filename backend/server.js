// db_connection.js must be imported first: it loads atlas-credentials.env
import { connectDB } from './db_connection.js';
import app from './app.js';

const PORT = process.env.PORT || 3000;

await connectDB();
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));