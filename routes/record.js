const express = require("express");
const recordRoutes = express.Router();
const dbo = require("../db/conn");

recordRoutes.route('/users').get(async function(req, res){
    const driver = await dbo.getDB()
    let { records, summary } = await driver.executeQuery(
        'MATCH (u:User) RETURN u',
        {},
        { database: 'neo4j' }
    )
    const results = []
    records.forEach((record) => {
        results.push({
            "id": record.get("u").elementId,
            "name": record.get("u").properties.name
        })
    })
    res.status(200).json({
        "status": "Success",
        "result": {
            "users": results
        }
    })
})

recordRoutes.route('/users').post(async function(req, res) {
    const { name } = req.body
    console.log(name)
    const driver = await dbo.getDB()
    let { records, summary } = await driver.executeQuery(
        'MERGE (u:User {name: $name})',
        {name: name},
        { database: 'neo4j' }
    )
    res.status(200).json({
        "status": "Success",
        "result": `Created ${summary.counters.updates().nodesCreated} nodes ` +
            `in ${summary.resultAvailableAfter} ms.`
    })
})

module.exports = recordRoutes;