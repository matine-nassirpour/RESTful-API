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
    jwt = require('jsonwebtoken')
;

require('dotenv').config();

const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQBu/PPSM66u2L3FHBxUngwr5PV53kc7Tl7Xqo9Y27S2VvfHSYdC
JD99Gbb8+MnljQmNRImcuSU3KFSPDAfZnztrO+aOQIM87QnIWb4rhxTc8LQKXHI1
AswXR6xOBagLeCAS7GE01q70rLtDv9ulBrmx3TYbvIh7y5kMRib78wkbmhp54STA
4PJyAGHwWWmpWsNnXAWA4KSyROP50C+ykIEYf5gZlXpLb1/wf1no/eC8Qb8QxQTV
XUCi7slT8JycjxBIUx8ZAbThzZtRkxhwtiU912E9DFb6rvwcLq7FMPImR7tq0HN+
u5cIIUugXaZt7Kltrtv5SEEQ+A80oWUS++/xAgMBAAECggEABCQBwKzW7oT9h3YG
BI4k7BpNoi9NvwOsfCVL1cfUlRznf5LZrfkGOVeVQRjTB3Jckd2luKgboFQr225a
eJ79K4H/lv0HKGW7gLMAakVO3PNJ9D0AscOZ86Bj6EFDxLHFmI8jDUKZIl2zWtK0
khKPKPiUxTIicWPmINQZLjsh8tqfLFrZjpRhdxGPsGs+LoVHVafyg6O9Rd2R4kAZ
Qj6f5NuIP6s8zUbaaT3DzyKOfBUthaNAXpGzBnjrNaU3a1IMyzBlDKEmXWczX482
1/BjcDxcHvhUe8zIK40ePFZOmWbKQXaRai/XSHeLSs4sasP2Z4lmxQ16ZfdoSIrX
bUMRQQKBgQDJvHvvcdcTZG/ZWuH2VepvTFNeV5kIAnpGj/DFFIsMFKFjBaTJVToL
i0pXgYUqq7fHUSfxnJDRhmIK3S7C52KtC36ejrr0TqxQ/O/Bvk8kk2oiHj5FN95G
U4uJBcliPP4rXlzIqTbWsMg7kYnMShBdTKqzNDvJvKPcNH5JjhXbmQKBgQCM15Gc
myodg5AJDp2auB2F84f0XvdQS2W0/Zx1KAhf0ITHiXim2zse/JcBrobiz42sfGrr
30UYS1ur30+3hKWEgh/CSpiGuHMxH0hPJGZwh0R6xEs/SxyEv2Spar9PccepXEEb
uuWoVPUzaT4aVGc4mhLj7pcL22qvLyLL7wQuGQKBgQCbAlYknU+KmhELbTbVJh0V
2grxIdP3gJfd4jo55NgWtz9uq+Z7wR3xwtyjsmTVbc6vu1862ne4V068VEna/xom
Jv/q63chw9XKASBkuUtsqkzR3HUykIQde5Jq/eRItN8ECeS3VrZJbtrcUq8UJxC9
7+v1+Lu7/lPWHwuujxuieQKBgAFAvavd+X7vt61M8vv4XVLeurviyGJveUUl6Glm
ZMStbzDzOR6K3rjE2HcMXWjRHdqF9NGKV+wCZ5tczjG8vVgzbCLnVPoF1AiA1bzW
fw7LNUG+U0kJ2wQXS8byCyeixHruNioP/JEFyHSfoAzN6WkofbiHW9KgLg/G5JFZ
2/ipAoGAfWyufqTcbMqjShE0ZGITDzoRoCvZbKvsxAHefQT60FzjQ5sVOixvL3sm
BL0XebjRdSgo1m9UROsUYMvrJB3mD/10Vnaloi5RDyozM/TvR6txgv3gTttJwmby
bGVHvNjm6Cx5yVmFUTodkWt6XLVzkfY/ObRMWziEP5N/8SFXK1c=
-----END RSA PRIVATE KEY-----`;
const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBu/PPSM66u2L3FHBxUngwr
5PV53kc7Tl7Xqo9Y27S2VvfHSYdCJD99Gbb8+MnljQmNRImcuSU3KFSPDAfZnztr
O+aOQIM87QnIWb4rhxTc8LQKXHI1AswXR6xOBagLeCAS7GE01q70rLtDv9ulBrmx
3TYbvIh7y5kMRib78wkbmhp54STA4PJyAGHwWWmpWsNnXAWA4KSyROP50C+ykIEY
f5gZlXpLb1/wf1no/eC8Qb8QxQTVXUCi7slT8JycjxBIUx8ZAbThzZtRkxhwtiU9
12E9DFb6rvwcLq7FMPImR7tq0HN+u5cIIUugXaZt7Kltrtv5SEEQ+A80oWUS++/x
AgMBAAE=
-----END PUBLIC KEY-----`;

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

app.listen(3000, () => {
    console.log(`Server listening on port ${PORT}!`);
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

app.post('/login', (req, res) => {
    const
        userEmail = req.body.username + "@payetoncawa.fr",
        username = req.body.username
    ;


    const token = jwt.sign({username}, privateKey, {algorithm: 'RS256'})

    /**
     * create QRCode every time this endpoint is called
     */
    QRCode.toDataURL("https://615f5fb4f7254d0017068109.mockapi.io/api/v1/customers", function (err, qrCode) {
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
            to: ['matin.nasirpour@epsi.fr', userEmail],
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

    // Verify the user existence
    if (username) {
        res.send(token)
    } else {
        res.status(404).send("No user found!")
    }
})