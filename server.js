require("dotenv").config();
const express = require("express");
const { engine } = require("express-handlebars");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;
const MSSV = process.env.MSSV || "23IT002";
const STUDENT_NAME = process.env.STUDENT_NAME || "Đoàn Quang Tuấn An";

const lastDigit = parseInt(MSSV.slice(-1), 10);
const vatRate = lastDigit + 4; // 2 + 4 = 6%
const prefix = MSSV.slice(-3); // '002'

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", "./views");

// Kết nối đa luồng: Đọc và Ghi độc lập
const readConn = mongoose.createConnection(process.env.MONGO_URI_READ);
const writeConn = mongoose.createConnection(process.env.MONGO_URI_WRITE);

const bookSchema = new mongoose.Schema({
    bookCode: { type: String, required: true },
    title: { type: String, required: true },
    basePrice: { type: Number, required: true },
    finalPrice: { type: Number, required: true },
});

const BookReadModel = readConn.model("Book", bookSchema);
const BookWriteModel = writeConn.model("Book", bookSchema);

// Middleware kiểm tra tiền tố 3 số cuối MSSV
function validateBookCode(req, res, next) {
    const { bookCode } = req.body;
    if (!bookCode || !bookCode.startsWith(prefix)) {
        return res.status(400).render("index", {
            error: `Lỗi: Mã sản phẩm bắt buộc phải có tiền tố là 3 số cuối MSSV (${prefix})`,
            books: [],
            vatRate,
            studentName: STUDENT_NAME,
            mssv: MSSV,
        });
    }
    next();
}

app.get("/", async (req, res) => {
    try {
        const books = await BookReadModel.find().lean();
        res.render("index", { books, vatRate, studentName: STUDENT_NAME, mssv: MSSV });
    } catch (err) {
        res.status(500).send("Lỗi đọc database: " + err.message);
    }
});

app.post("/books", validateBookCode, async (req, res) => {
    try {
        const { bookCode, title, basePrice } = req.body;
        const price = parseFloat(basePrice);
        const finalPrice = Math.round(price * (1 + vatRate / 100));

        const newBook = new BookWriteModel({ bookCode, title, basePrice: price, finalPrice });
        await newBook.save();
        res.redirect("/");
    } catch (err) {
        res.status(500).send("Lỗi ghi database: " + err.message);
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
