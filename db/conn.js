const neo4j = require('neo4j-driver');

let _driver

module.exports = {
    connectToDB: async function() {
        try {
            console.log(process.env.DB_USER)
            _driver = neo4j.driver(process.env.URI,  neo4j.auth.basic(process.env.DB_USER, process.env.PASSWORD))
            const serverInfo = await _driver.getServerInfo()
            console.log('Connection established')
            console.log(serverInfo)
        } catch(err) {
            console.log(`Connection error\n${err}\nCause: ${err.cause}`)
            await _driver.close()
        }
    },
    getDB: async function(){
        return _driver
    }
}

