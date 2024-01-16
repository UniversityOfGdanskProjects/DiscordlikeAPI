const express = require("express");
const recordRoutes = express.Router();
const dbo = require("../db/conn");

recordRoutes.route('/users').get(async function(req, res){
    const driver = await dbo.getDB()
    let { records, _ } = await driver.executeQuery(
        'MATCH (u:User) RETURN u',
        {},
        { database: 'neo4j' }
    )
    const results = []
    records.forEach((record) => {
        results.push({
            "id": record.get("u").properties.id,
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
    const { name, id } = req.body
    const driver = await dbo.getDB()
    let { _, summary } = await driver.executeQuery(
        'MERGE (u:User {id: $id, name: $name})',
        {name: name, id: parseInt(id)},
        { database: 'neo4j' }
    )
    res.status(200).json({
        "status": "Success",
        "result": `Created ${summary.counters.updates().nodesCreated} nodes ` +
            `in ${summary.resultAvailableAfter} ms.`
    })
})

recordRoutes.route('/users/:id').get(async function(req, res) {
    const { id } = req.params
    const driver = await dbo.getDB()
    let { records, _ } = await driver.executeQuery(
        'MATCH (n:User {id: $id}) RETURN n',
        {id: parseInt(id)},
        { database: 'neo4j' }
    )
    if (records.length > 0){
        const result = {
            "id": records[0].get("n").properties.id,
            "name": records[0].get("n").properties.name
        }
        res.status(200).json({
            "status": "Success",
            "result": {
                "user": result
            }
        })
    } else {
        res.status(200).json({
            "status": "Error",
            "error": "No user found"
        })
    }


})

recordRoutes.route('/users/:id').delete(async function(req, res) {
    const { id } = req.params
    const driver = await dbo.getDB()
    let { _, summary } = await driver.executeQuery(
        'MATCH (n:User {id: $id}) DETACH DELETE n',
        {id: parseInt(id)},
        { database: 'neo4j' }
    )
    res.status(200).json({
        "status": "Success",
        "result": `Deleted ${summary.counters.updates().nodesDeleted} nodes ` +
            `in ${summary.resultAvailableAfter} ms.`
    })
})

module.exports = recordRoutes;