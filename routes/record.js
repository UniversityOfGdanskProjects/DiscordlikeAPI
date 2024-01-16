const express = require("express");
const recordRoutes = express.Router();
const dbo = require("../db/conn");

recordRoutes.route('/users')
    .get(async function(req, res){
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

module.exports = recordRoutes;