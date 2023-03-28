const
    express = require('express'),
    app = express(),
    productsRequest = require('request'),
    customersRequest = require('request'),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    helmet = require('helmet'),
    QRCode = require('qrcode'),
    nodemailer = require('nodemailer'),
    PORT = 3000,
    uuid = require('uuid'),
    mysql = require('mysql2'),
    formatDate = require('date-and-time'),
    dotenv = require('dotenv').config()
;

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

let
    productsImportedJson = [],
    customersImportedJson = []
;
productsRequest (
    'https://615f5fb4f7254d0017068109.mockapi.io/api/v1/products',
    function (error, response, body) {
        if (!error && response.statusCode === 200)
            productsImportedJson = JSON.parse(body);
    });
customersRequest (
    'https://615f5fb4f7254d0017068109.mockapi.io/api/v1/customers',
    function (error, response, body) {
        if (!error && response.statusCode === 200)
            customersImportedJson = JSON.parse(body)
    });

/**
 * Process data sent in an HTTP request body.
 */
app.use(bodyParser.json());

/**
 * Add HTTP headers to allow a user agent to access resources from a server located on another origin than the current site.
 */
app.use(cors());

/**
 * Hamlet is just html without redundancies. It uses the white space to automatically close tags.
 */
app.use(helmet());

app.get('/', (req, res) => {
    res.status(200).json('There is no data here! Meet at localhost:3000/products');
});

app.get('/products', (req, res) => {
    const uuid = req.query.uuid;

    if (checkSessionToken(uuid)) {
        res.status(200).json(productsImportedJson);
    } else {
        res.status(401).json("Not authenticated")
    }
});

app.get('/products/:id', (req, res) => {
    const uuid = req.query.uuid;

    if (checkSessionToken(uuid)) {
        const
            id = req.params.id,
            product = productsImportedJson.find(product => product.id === id)
        ;
        res.status(200).json(product);
    } else {
        res.status(401).json("Not authenticated")
        console.log(uuid)
    }
});

app.get('/products/:id/stock', (req, res) => {

    if (checkSessionToken(req.query.uuid)) {
        const
            id = req.params.id,
            product = productsImportedJson.find(product => product.id === id)
        ;

        res.status(200).json(product.stock);
    }
});

app.get('/customers', (req, res) => {
    res.status(200).json(customersImportedJson);
});

app.get('/customers/:id/orders', (req, res) => {
    const
        id = req.params.id,
        customer = customersImportedJson.find(customer => customer.id === id)
    ;

    res.status(200).json(customer.orders);
});

app.get('/customers/:email', (req, res) => {
    const
        email = req.params.email,
        customer = customersImportedJson.find(customer => customer.email === email)
    ;

    if (!customer) {
        res.status(400).json(customer)
    } else {
        res.status(200).json(customer)
    }
});

// Create and return a unique URL with token
function createAuthenticationUrl(user) {
    const uuidToken = uuid.v4();
    const now = new Date(Date.now())
    const nowFormatted = formatDate.format(now, "YYYY-MM-DD HH:mm:ss")
    // const expirationTime = new Date(now.setTime(now.getTime() + (1 * 60 * 60 * 1000)))
    const expirationTime = new Date(now.setTime(now.getTime() + 60000))
    const expirationTimeFormatted = formatDate.format(expirationTime, "YYYY-MM-DD HH:mm:ss")

    // Save the uuidToken to your user database, together with the user ID and expiration time
    connection.connect(function (err) {
       if (err) throw err;

       const sql = "INSERT INTO token VALUES (DEFAULT, ?, ?, ?, ?)";

       connection.query(sql, [uuidToken, user, nowFormatted, expirationTimeFormatted], function (err, result, fields) {
          if (err) throw err;
       });
    });

    return 'http://' + process.env.DB_HOST + `:${PORT}/login/verification?uuid=${uuidToken}&user=${user}`;
}

// Endpoint to login and generate a token
app.post('/login', (req, res) => {
    function authenticateUser(username) {
        const user = customersImportedJson.find(customer => customer.username === username);

        if (!user) {
            res.status(400).json("User not found")
        } else {
            res.status(200).json(user);
        }

        return user.username;
    }

    // Authenticate user
    const
        email = req.body.email,
        parseEmail = email.split('@'),
        username = parseEmail[0],
        userToAuthenticate = authenticateUser(username)
    ;

    if (!userToAuthenticate) {
        return res.status(401).json({ message: 'Invalid username'});
    }

    // Create unique URL with token
    const authenticationUrl = createAuthenticationUrl(userToAuthenticate);

    /**
     * create QRCode every time this endpoint is called
     */
    QRCode.toDataURL(authenticationUrl, function (err, qrCode) {
        let transporter = nodemailer.createTransport({
            service: process.env.EMAIL_HOST,
            port: process.env.PORT,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: [process.env.EMAIL_USER, email],
            subject: `Sending Email using Nodemailer`,
            html: '<img src="'+ qrCode + '" alt="missing qr code">'
        };

        transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    })

    // Return authentication URL
    return res.json({ authenticationUrl })
})

app.get('/login/verification', (req, res) => {
    const user = req.query.user;
    const uuid = req.query.uuid;

    const tokenRequest = "SELECT * FROM token WHERE username = ?";

    connection.query(tokenRequest, user, function (err, rows, fields) {
        if (err) {
            console.log("[mysql error]", err.stack);
        }

        if (rows.length === 0) {
            return res.status(401).json("Invalid credentials")
        } else {
            if (rows[0].uuid_token === uuid && rows[0].username === user) {

                const
                    expirationTime = rows[0].expiration_time,
                    creationDate = rows[0].creation_date
                ;

                if (creationDate.valueOf() < expirationTime.valueOf()) {
                    //write uuid to session_token table
                    const now = new Date(Date.now())
                    const nowFormatted = formatDate.format(now, "YYYY-MM-DD HH:mm:ss")
                    const expirationTime = new Date(now.setTime(now.getTime() + 60000))
                    const expirationTimeFormatted = formatDate.format(expirationTime, "YYYY-MM-DD HH:mm:ss")
                    connection.query("INSERT INTO session_token VALUES (?, ?, ?)", [uuid, nowFormatted, expirationTimeFormatted], function (err, rows, fields) {
                        if (err) {
                            console.log("[mysql error]", err.stack);
                        }});
                    res.status(200).json(uuid);

                }else {
                    return res.status(401).json("Token expired")
                }
            }
        }

    });
})

function checkSessionToken(uuid) {

    const tokenRequest = "SELECT * FROM session_token WHERE uuid_token = ?";
    let bool = false;

    connection.query(tokenRequest, uuid, function (err, rows, fields) {
        if (rows.length === 0) {
            bool = false;
        } else {
            if (rows[0].uuid_token === uuid) {

                const
                    expirationTime = rows[0].expiration_time,
                    creationDate = rows[0].creation_date;

                if (creationDate.valueOf() < expirationTime.valueOf())
                {
                    bool = true;
                }
            }
        }

    }
        )
    return bool;
}


app.listen(3000, () => {
    console.log(`Server listening on port ${PORT}!`);
});
