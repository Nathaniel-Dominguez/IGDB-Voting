import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 IGDB API configured: ${process.env.IGDB_CLIENT_ID ? 'Yes' : 'No'}`);
});
