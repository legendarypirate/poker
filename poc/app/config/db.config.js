module.exports = {
  HOST: "localhost",
  USER: "postgres", // Postgres default username
  PASSWORD: "Joker0328", // Enter your PostgreSQL password here
  DB: "poker",
  dialect: "postgres", // Change dialect to postgres
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};
