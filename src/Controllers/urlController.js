const urlModel = require('../models/urlModel')
const shortid = require('shortid')
const redis = require("redis");
const baseUrl = "http://localhost:3000/"

const { promisify } = require("util");

//Connect to redis
const redisClient = redis.createClient(
    10976,
    "redis-10976.c301.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("63Fkn6vvGYtfftugyWgr7LrK8Emyqedh", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});
//1. connect to the server
//2. use the commands :

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

const isValid = function (value) {
    if (typeof value == "undefined" || value == null) return false;
    if (typeof value == "string" && value.trim().length == 0) return false;
    if (typeof value == "number") return false;
    return true;
}

const isValidURL = function (URL) {
    return /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%.\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%\+.~#?&//=]*)/.test(URL)
}

const createURL = async function (req, res) {
    try {
        let data = req.body
        const longUrl = data.longUrl

        if (Object.keys(data).length == 0) return res.status(400).send({ status: false, message: "Please Provide data" })

        if (!isValid(longUrl)) return res.status(400).send({ status: false, message: "Please provide URL" })
        if (!isValidURL(longUrl)) return res.status(400).send({ status: false, message: "Please provide valid URL" })

        let cachedURLData = await GET_ASYNC(`${longUrl}`)
        if (cachedURLData) return res.status(200).send({ status: true, message: "URL already shortened", data: JSON.parse(cachedURLData) })

        let checkUrl = await urlModel.findOne({ longUrl: longUrl }).select({ _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        if (checkUrl) {
            await SET_ASYNC(`${longUrl}`, JSON.stringify(checkUrl))
            return res.status(200).send({ status: true, message: "long Url already  Shortned", data: checkUrl })
        }

        const urlCode = shortid.generate().toLowerCase()
        let shortUrl = baseUrl + urlCode

        let urldata = {
            "longUrl": longUrl,
            "shortUrl": shortUrl,
            "urlCode": urlCode
        }

        await urlModel.create(urldata)
        res.status(201).send({ status: true, message: "URL shortened Successfully", data: urldata })
    }
    catch (err) {
        res.status(500).send({ status: false, message: err.message })
    }
}


const getUrl = async function (req, res) {
    try {
        let urlCode = req.params.urlCode

        if (!shortid.isValid(urlCode)) return res.status(400).send({ status: false, message: "please enter valid URL code" })

        let cachedURLData = await GET_ASYNC(`${urlCode}`)
        if (cachedURLData) {
            return res.status(302).redirect(JSON.parse(cachedURLData))

        } else {
            let findUrl = await urlModel.findOne({ urlCode: urlCode })
            if (!findUrl) return res.status(404).send({ status: false, message: "UrlCode does not found!!" })

            await SET_ASYNC(`${urlCode}`, JSON.stringify(findUrl.longUrl))

            return res.status(302).redirect(findUrl.longUrl)
        }
    }
    catch (err) {
        res.status(500).send({ status: false, message: err.message })
    }
}


module.exports = { createURL, getUrl }