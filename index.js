import {NULL} from "mysql/lib/protocol/constants/types";

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
    jwt = require('jsonwebtoken'),
    uuid = require('uuid')
;

import { connection } from './db';

require('dotenv').config();

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
        res.status(200).json(customer);


    }
});








const secretKey = 'bluelaggonousaphire';

// Create and return a JWT token
// function createToken(user) {
//     return jwt.sign({id: user.id}, secretKey);
// }

// Create and return a unique URL with token
function createAuthenticationUrl(user) {
    // const token = createToken(user);
    const uuidToken = uuid.v4();

    // Save the uuidToken to your user database, together with the user ID and expiration time
    connection.connect(function (err) {
       if (err) throw err;
       console.log('Connected!');

       const sql = "INSERT INTO token VALUES (DEFAULT, ?, ?, DEFAULT, 3600)";

       connection.query(sql, [uuidToken, user], function (err, result, fields) {
          if (err) throw err;
          console.log(result)
       });
    });

    return `https://localhost:3000/login/${uuidToken}`;
}

// Middleware to verify JWT tokens
function verifyToken(req, res, next) {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ message: 'Missing authorization token' });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        req.userId = decoded.id;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid authorization token' });
    }
}








// Endpoint to login and generate a token
app.post('/login', (req, res) => {
    function authenticateUser(username) {
        const user = customersImportedJson.find(customer => customer.username === username);

        if (!user) {
            res.status(400).json(user)
        } else {
            res.status(200).json(user);
        }

        return user;
    }

    // Authenticate user
    const
        email = req.body.email,
        parseEmail = email.split('@'),
        username = parseEmail[0],
        user = authenticateUser(username)
    ;

    if (!user) {
        return res.status(401).json({ message: 'Invalid username'});
    }

    // Create unique URL with token
    const authenticationUrl = createAuthenticationUrl(user);

    /**
     * create QRCode every time this endpoint is called
     */
    QRCode.toDataURL("http://localhost:3000/login/verification", function (err, qrCode) {
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

app.get('/login/verification', /*verifyToken,*/ (req, res) => {
    const user = req.query.username;
    const uuid = req.query.uuid;

    const sql = "SELECT * FROM token WHERE uuid_token = ?";

    connection.query(sql, uuid, function (err, rows, fields) {
        if (err) throw err;

        if (rows[1] === uuid && rows[2] === user) {
            return res.status(200).json("User authenticated")
        } else {
            return res.status(401).json("Something went wrong")
        }
    });

    // return res.json({ user })
})

app.listen(3000, () => {
    console.log(`Server listening on port ${PORT}!`);
});
