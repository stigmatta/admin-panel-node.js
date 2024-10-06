const express = require('express');
const mssql = require('mssql');
const path = require('path');
const session = require('express-session'); 
const cookieParser = require("cookie-parser");

const app = express();
const port = 8080;

const config = {
    server: 'AndreyPC',
    database: 'Goods',
    user: 'test',
    password: '12345',
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
    port: 1433,
};

mssql.connect(config, err => {
    if (err) {
        console.error('Error', err);
    } else {
        console.log('DB Connected');
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'images')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('main', { error: 0 });
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await new mssql.Request()
            .input('username', mssql.VarChar, username)
            .input('password', mssql.VarChar, password)
            .query('SELECT * FROM users WHERE username = @username AND password = @password');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];

            req.session.user = {
                username: user.username,
                isAdmin: user.is_admin
            };

            const goodsResult = await new mssql.Request().query('SELECT * FROM goods');

            res.render('goods', {
                admin: user.is_admin ? 'yes' : 'no',
                goods: goodsResult.recordset
            });
        } else {
            res.render('main', { error: 1 });
        }
    } catch (err) {
        console.error('Error on login', err);
        res.status(500).send('Server error');
    }
});

app.get('/login', async (req, res) => {
    const categoryName = req.query.category;
    let query = 'SELECT * FROM goods';
    
    if (categoryName && categoryName !== 'all') {
        query += ' WHERE type = @type';
    }

    try {
        const request = new mssql.Request();
        if (categoryName && categoryName !== 'all') {
            request.input('type', mssql.VarChar, categoryName);
        }

        const goodsResult = await request.query(query);

        res.render('goods', {
            admin: req.session.user ? (req.session.user.isAdmin ? 'yes' : 'no') : 'no',
            goods: goodsResult.recordset
        });
    } catch (err) {
        console.error('Error retrieving goods', err);
        res.status(500).send('Server error');
    }
});

app.post('/logout', async(req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error during logout', err);
            return res.status(500).send('Server error');
        }
        res.redirect('/'); 
    });
});

app.post('/edit', async (req, res) => {
    try {
        const newName = req.body.itemName;
        const price = req.body.price;
        const newPrice = req.body.newPrice ? parseFloat(req.body.newPrice) : null; 
        const type = req.body.type;
        const id = req.body.itemId;
        const isNotAvailable = req.body.available === 'on';

        const request = new mssql.Request();

        request.input('name', mssql.VarChar, newName)
               .input('price', mssql.Float, price)
               .input('type', mssql.VarChar, type)
               .input('isNotAvailable', mssql.Bit, isNotAvailable)
               .input('id', mssql.Int, id);

        if (newPrice !== null) {
            request.input('newPrice', mssql.Float, newPrice);
        }

        let query = `
            UPDATE Goods
            SET name = @name,
                price = @price,
                type = @type,
                isNotAvailable = @isNotAvailable
        `;
        
        if (newPrice !== null) {
            query += `, newPrice = @newPrice`;
        }

        query += ` WHERE id = @id`;

        await request.query(query);

        res.redirect('/login'); 
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/delete', async (req, res) => {
    try {
        const id = req.body.deletedId;
        const request = new mssql.Request();
        await request.input('id', mssql.Int, id)
            .query('DELETE FROM Goods WHERE id = @id');

        res.redirect('/login'); 
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/add',async(req,res) =>{
    try{
        const newName = req.body.itemName;
        const img = req.body.itemImage
        const price = req.body.price;
        const newPrice = req.body.newPrice ? parseFloat(req.body.newPrice) : null; 
        const type = req.body.type;
        const isNotAvailable = req.body.available === 'on';

        const request = new mssql.Request();

        request.input('name', mssql.VarChar, newName)
                .input('img',mssql.VarChar,img)
               .input('price', mssql.Float, price)
               .input('type', mssql.VarChar, type)
               .input('isNotAvailable', mssql.Bit, isNotAvailable)

        if (newPrice !== null) {
            request.input('newPrice', mssql.Float, newPrice);
        }

        let query = `
            INSERT INTO Goods(name,img,price,
        `;
        
        if (newPrice !== null) {
            query += `newPrice,`;
        }

        query += `isNotAvailable,type) VALUES (@name,@img,@price,`;
        if (newPrice !== null) {
            query += `@newPrice,`;
        }
        query+=`@isNotAvailable,@type)`

        await request.query(query);

        res.redirect('/login'); 
    
    }catch(error){
        console.error('Error adding item:', error);
        res.status(500).send('Internal Server Error');
    }
})




app.listen(port, err => {
    if (err) {
        console.log('Error in listening to this port');
    } else {
        console.log(`Port ${port} is listening`);
    }
});
