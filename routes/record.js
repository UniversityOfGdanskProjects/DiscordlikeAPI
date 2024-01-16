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
            "name": record.get("u").properties.name,
            "password": record.get("u").properties.password,
            "isAdmin": record.get("u").properties.isAdmin
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
    const { name, id, password, isAdmin } = req.body
    const driver = await dbo.getDB()
    let { _, summary } = await driver.executeQuery(
        'MERGE (u:User {id: $id, name: $name, password: $password, isAdmin: $isAdmin})',
        {name: name,
            id: parseInt(id),
            password: password,
            isAdmin: isAdmin},
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
        'MATCH (u:User {id: $id}) RETURN u',
        {id: parseInt(id)},
        { database: 'neo4j' }
    )
    if (records.length > 0){
        const result = {
            "id": records[0].get("u").properties.id,
            "name": records[0].get("u").properties.name,
            "password": records[0].get("u").properties.password,
            "isAdmin": records[0].get("u").properties.isAdmin
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

recordRoutes.route('/users/:id').put(async function(req, res) {
    const { id } = req.params
    const { name, password, isAdmin } = req.body
    let query = 'MATCH (u:User {id: $id})'
    if (!!name){
        query = `${query} SET u.name = $name`
    }
    if (!!password){
        query = `${query} SET u.password = $password`
    }
    if (!!isAdmin){
        query = `${query} SET u.isAdmin = $isAdmin`
    }
    const driver = await dbo.getDB()
    let { _, summary } = await driver.executeQuery(
        query,
        {id: parseInt(id), name: name, password: password, isAdmin: isAdmin},
        { database: 'neo4j' }
    )
    res.status(200).json({
        "status": "Success",
        "result": `Set ${summary.counters.updates().propertiesSet} properties ` +
            `in ${summary.resultAvailableAfter} ms.`
    })
})



recordRoutes.route('/channels').get(async function(req, res){
    const driver = await dbo.getDB()
    let { records, _ } = await driver.executeQuery(
        'MATCH (c:Channel) RETURN c',
        {},
        { database: 'neo4j' }
    )
    const results = []
    records.forEach((record) => {
        results.push({
            "id": record.get("c").properties.id,
            "name": record.get("c").properties.name
        })
    })
    res.status(200).json({
        "status": "Success",
        "result": {
            "channels": results
        }
    })
})


recordRoutes.route('/channels/:id').get(async function(req, res) {
    const { id } = req.params
    const driver = await dbo.getDB()
    let { records, _ } = await driver.executeQuery(
        'MATCH (c:Channel {id: $id}) RETURN c',
        {id: parseInt(id)},
        { database: 'neo4j' }
    )
    if (records.length > 0){
        const result = {
            "id": records[0].get("c").properties.id,
            "name": records[0].get("c").properties.name
        }
        res.status(200).json({
            "status": "Success",
            "result": {
                "channel": result
            }
        })
    } else {
        res.status(200).json({
            "status": "Error",
            "error": "No channel found"
        })
    }
})

recordRoutes.route('/channels').post(async function(req, res) {
    const { name, id } = req.body
    const driver = await dbo.getDB()
    let { _, summary } = await driver.executeQuery(
        'MERGE (c:Channel {id: $id, name: $name})',
        {name: name,
            id: parseInt(id)},
        { database: 'neo4j' }
    )
    res.status(200).json({
        "status": "Success",
        "result": `Created ${summary.counters.updates().nodesCreated} nodes ` +
            `in ${summary.resultAvailableAfter} ms.`
    })
})

recordRoutes.route('/channels/:id').delete(async function(req, res) {
    const { id } = req.params
    const driver = await dbo.getDB()
    let { _, summary } = await driver.executeQuery(
        'MATCH (c:Channel {id: $id}) DETACH DELETE c',
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