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
    mysql = require('mysql'),
    dotenv = require('dotenv').config()
    formatDate = require('date-and-time')
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
   res.status(200).json(productsImportedJson);
});

app.get('/products/:id', (req, res) => {
    const
        id = req.params.id,
        product = productsImportedJson.find(product => product.id === id)
    ;

    res.status(200).json(product);
});

app.get('/products/:id/stock', (req, res) => {
    const
        id = req.params.id,
        product = productsImportedJson.find(product => product.id === id)
    ;

    res.status(200).json(product.stock);
});

app.get('/customers', (req, res) => {
    res.status(200).json(customersImportedJson);
});

// app.get('/customers/:id', (req, res) => {
//     const
//         id = req.params.id,
//         customer = customersImportedJson.find(customer => customer.id === id)
//     ;
//
//     res.status(200).json(customer);
// });

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
    console.log("now formatted time", nowFormatted)
    // const expirationTime = new Date(now.setTime(now.getTime() + (1 * 60 * 60 * 1000)))
    const expirationTime = new Date(now.setTime(now.getTime() + 120000))
    console.log("Expiration time", expirationTime)
    const expirationTimeFormatted = formatDate.format(expirationTime, "YYYY-MM-DD HH:mm:ss")
    console.log("Expiration time formatted", expirationTimeFormatted)

    // Save the uuidToken to your user database, together with the user ID and expiration time
    connection.connect(function (err) {
       if (err) throw err;

       const sql = "INSERT INTO token VALUES (DEFAULT, ?, ?, ?, ?)";

       connection.query(sql, [uuidToken, user, nowFormatted, expirationTimeFormatted], function (err, result, fields) {
          if (err) throw err;
       });
    });

    return `http://localhost:3000/login/verification?uuid=${uuidToken}&user=${user}`;
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
            from: 'matin.nasirpour@epsi.fr',
            to: ['matin.nasirpour@epsi.fr', email],
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

    const tokenRequest = "SELECT * FROM token WHERE uuid_token = ?";

    connection.query(tokenRequest, uuid, function (err, rows, fields) {
        if (err) throw err;

        if (rows[0].uuid_token === uuid && rows[0].username === user) {

            console.log("Token expiration time: ", (rows[0].expiration_time).valueOf())
            console.log("Token creation date:", (rows[0].creation_date).valueOf())

            const
                expirationTime = rows[0].expiration_time,
                creationDate = rows[0].creation_date
            ;

            if (creationDate.valueOf() < expirationTime.valueOf()) {
                res.status(200).json("User authenticated");
            } else {
                return res.status(401).json("Token expired")
            }
        } else {
            return res.status(401).json("You authentication token is not valid any more")
        }
    });
})

app.listen(3000, () => {
    console.log(`Server listening on port ${PORT}!`);
});
