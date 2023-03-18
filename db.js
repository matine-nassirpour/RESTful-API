const mysql = require('mysql');
const http = require('http');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mspr_users_token'
});

// connection.connect(function(err) {
//     if (err) throw err;
//     console.log('Connected!');
// });

// connection.query('SELECT * FROM yourtable', function (err, result, fields) {
//     if (err) throw err;
//     console.log(result);
// });

