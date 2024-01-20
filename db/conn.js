const neo4j = require('neo4j-driver');

// eslint-disable-next-line no-underscore-dangle
let _driver;

module.exports = {
  async connectToDB() {
    try {
      _driver = neo4j.driver(
        process.env.URI,
        neo4j.auth.basic(
          process.env.DB_USER,
          process.env.PASSWORD,
        ),
      );
      // const serverInfo = await _driver.getServerInfo()
      // eslint-disable-next-line no-console
      console.log('Connection established');
      // console.log(serverInfo)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`Connection error\n${err}\nCause: ${err.cause}`);
      await _driver.close();
    }
  },
  async getDB() {
    return _driver;
  },
};
