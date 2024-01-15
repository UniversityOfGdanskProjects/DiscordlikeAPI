(async () => {
    const express = require('express');
    const cors = require('cors');
    require('dotenv').config({ path: require('find-config')('.env') })
    const port = process.env.PORT || 5000;
    const app = express();
    app.use(cors());
    app.use(express.json());
    // app.use(require("./routes/record"));

    const dbo = require("./db/conn");
    console.log(require('dotenv').config());

    app.listen(port, ()=> {
        dbo.connectToDB();
        console.log(`Server is running on ${port}`);
    })

})();