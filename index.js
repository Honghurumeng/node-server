const express = require('express');
const axios = require('axios');
// const puppeteer = require('puppeteer');
const chalk = require('chalk');//"chalk": "^2.4.2",
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
// const http = require('http');
const ngrok = require('@ngrok/ngrok');
const nodemailer = require('nodemailer');
const session = require('express-session');
const multer = require('multer');

let dev = process.argv.find(arg => arg.startsWith('--dev'));
if (dev) {
    console.log(chalk.yellow('Development mode enabled.'));
} else {
    console.log(chalk.yellow('Production mode enabled.'));
}

// Create an instance of Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'app/' });

app.use(session({
    secret: 'honghurumeng',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 10 * 60 * 1000, secure: false } // 如果你的应用在 HTTPS 环境下运行，应该将 secure 设置为 true
}));

// Create webserver
// http.createServer((req, res) => {
// 	res.writeHead(200, { 'Content-Type': 'text/html' });
// 	res.end('Congrats you have created an ngrok web server');
// }).listen(8080, () => console.log('Node.js web server at 8080 is running...'));

let ip = '';
if (dev) {
    const networkInterfaces = os.networkInterfaces();
    // 输出网络接口信息
    for (const key in networkInterfaces) {
        const iface = networkInterfaces[key];
        for (const address of iface) {
            if (address.family === 'IPv4' && !address.internal) {
                ip = address.address;
            }
        }
    }
}

// Start the server
const port = process.env.PORT || 3000;

const GITHUB_REPO = 'Honghurumeng/Honghurumeng.github.io';
const GITHUB_TOKEN = process.env.GITHUB_IO_ADDRESS;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    if (dev) {
        console.log(`http://${ip}:${port}`);
    }
});

(async function () {
    try {
        if (dev) {
            return;
        }

        // 设置 authtoken
        await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);

        // 启动一个 HTTP 隧道，将本地的 3000 端口映射到公网
        const url = await ngrok.connect(3000);
        console.log(`Ngrok URL: ${url.url()}`);
        let TERMUX_ADDRESS = url.url();

        sendPushMessage('Node Server Started', 'Ngrok URL: ' + url.url() + '\n' + '服务器已启动，等待GitHub Actions进行重定向');
        // sendEmail('[Node-server] Starting...', 'Ngrok URL: ' + url.url() + '\n' + '服务器已启动，等待GitHub Actions进行重定向');

        const url1 = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        };
        const data = {
            'event_type': 'update_address',
            'client_payload': {
                'address': TERMUX_ADDRESS,
                'callback_url': `${TERMUX_ADDRESS}/webhook-result`
            }
        };

        try {
            await axios.post(url1, data, { headers });
            console.log('Webhook triggered successfully');
        } catch (error) {
            console.error('Failed to trigger webhook', error);
        }
    } catch (err) {
        console.error('Error while connecting Ngrok', err);
    }
})();

app.post('/webhook-result', async (req, res) => {
    console.log('GitHub Actions completed:', req.body);

    const batteryInfo = await getBatteryInfo();
    let batteryNum = batteryInfo.percentage;
    sendPushMessage('Node Server redirected to GitHub.io / ' + batteryNum, '当前系统电量：' + batteryNum + '\n' + JSON.stringify(batteryInfo) + '\n' + '服务器已启动，可通过GitHub Page进入');
    sendEmail('Node Server redirected to GitHub.io', '当前系统电量：' + batteryNum + '\n' + JSON.stringify(batteryInfo) + '\n' + '服务器已启动，可通过GitHub Page进入');
    setInterval(async () => {
        const batteryInfo = await getBatteryInfo();
        let batteryNum = batteryInfo.percentage;
        sendPushMessage('Battery Percentage ' + batteryNum, JSON.stringify(batteryInfo));
        // sendEmail('当前系统电量：' + batteryNum);
    }, 1000 * 60 * 30);

    res.status(200).send('Result received');
});

// 解析请求体中的JSON数据
// 处理表单提交的数据
app.use(express.urlencoded({ extended: true }));
// 托管静态资源，index设置为false表示禁用此行为，即如果请求的是一个目录，服务器不会自动发送index.html，而是继续匹配后续的路由
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// let lastIp = null;

// 检查请求的IP地址，如果和上一次不同，就打印出来
app.use((req, res, next) => {
    // console.log(req)
    // if (req.ip !== lastIp) {
    console.log(`${formatTime(Date.now())} Received a ${req.method} request from ${req.ip} for ${req.url}`);
    // console.log('Forbidden', req.url);

    // if(req.url.endsWith('.html') || req.url.endsWith('.js') || req.url.endsWith('.css') || req.url.endsWith('.png') || req.url.endsWith('.jpg') || req.url.endsWith('.ico')) {
    //     // 拒绝访问
    //     console.log('Forbidden', req.url);
    //     res.status(403).send('Forbidden');
    //     return;
    // }
    // lastIp = req.ip;
    // }
    next();
});

function formatTime(time) {
    var date = new Date(time);
    Y = date.getFullYear() + '-';
    M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-';
    D = date.getDate() < 10 ? '0' + date.getDate() + ' ' : date.getDate() + ' ';
    h = date.getHours() < 10 ? '0' + date.getHours() + ':' : date.getHours() + ':';
    m = date.getMinutes() < 10 ? '0' + date.getMinutes() + ':' : date.getMinutes() + ':';
    s = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
    return Y + M + D + h + m + s;
}

app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'public/login.html'), 'utf8');
    res.send(html);
});

app.post('/login', (req, res) => {
    const password = req.body.password;
    if (password === process.env.NODE_SERVER_PASSWORD || dev) {
        req.session.user = {
            username: 'hhrm'
        };
        res.json({ success: true });
    } else {
        res.json({ success: false, message: '密码错误' });
    }
});

app.get('/index', (req, res) => {
    if (req.session.user) {
        let html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
        res.send(html);
    } else {
        res.redirect('/');
    }
});

app.get('/blog', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'public/blog.html'), 'utf8');
    res.send(html);
});

app.get('/build/three.module.js', (req, res) => {
    let js = fs.readFileSync(path.join(__dirname, 'public/threejs/scripts/three.module.js'), 'utf8');
    res.setHeader('Content-Type', 'application/javascript');
    res.send(js);
});

app.get('/threejs/utils/BufferGeometryUtils.js', (req, res) => {
    let js = fs.readFileSync(path.join(__dirname, 'public/threejs/scripts/BufferGeometryUtils.js'), 'utf8');
    res.setHeader('Content-Type', 'application/javascript');
    res.send(js);
});

// 将传来的一个json对象转换为字符串，然后保存到/app/trello.json文件中
app.post('/saveTrello', (req, res) => {
    const data = JSON.stringify(req.body,
        null, 2);
    fs.writeFile(path.join(__dirname, 'app/trello.json'), data, (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).send('Error writing file');
        }
        res.status(200).send('File saved');
    }
    );
});

// 读取/app/trello.json文件，将内容转换为json对象，然后发送给客户端
app.get('/getTrello', (req, res) =>
    fs.readFile(path.join(__dirname, 'app/trello.json'), 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.send({ success: false, message: 'Error reading file' });
        }
        res.send({ success: true, data: JSON.parse(data) });
    })
);

app.post('/api/uploadFile', upload.single('file'), (req, res) => {
    // 获取上传的文件对象
    const file = req.file;
    let filename = req.body.filename;

    if (file) {
        // 获取文件的临时路径
        const tempPath = file.path;

        // 获取文件名和扩展名
        const ext = path.extname(filename);
        const basename = path.basename(filename, ext);

        // 创建一个函数来生成一个唯一的文件名
        const generateUniqueFilename = (basename, ext, suffix = 0) => {
            // 如果后缀大于0，添加到文件名
            const newBasename = suffix > 0 ? `${basename}-${suffix}` : basename;
            const newFilename = `${newBasename}${ext}`;
            const targetPath = path.join(__dirname, 'app', newFilename);

            // 检查文件是否已存在
            fs.access(targetPath, fs.constants.F_OK, (err) => {
                if (!err) {
                    // 文件已存在，尝试下一个后缀
                    generateUniqueFilename(basename, ext, suffix + 1);
                } else {
                    // 文件不存在，可以使用这个文件名
                    renameFile(tempPath, targetPath);
                }
            });
        };

        // 创建一个函数来重命名文件
        const renameFile = (tempPath, targetPath) => {
            fs.rename(tempPath, targetPath, (err) => {
                if (err) {
                    console.error('Error renaming file:', err);
                    return res.status(500).send('Error renaming file');
                }
                console.log(chalk.green('File renamed to:', targetPath));
                res.status(200).send('File uploaded and renamed');
            });
        };

        // 开始生成唯一的文件名
        generateUniqueFilename(basename, ext);
    } else {
        res.status(400).send('No file uploaded');
    }
});

app.get('/api/getFileInfo', (req, res) => {
    const filename = req.query.filename;
    const directoryPath = path.join(__dirname, 'app');
    fs.stat(path.join(directoryPath, filename), (err, stats) => {
        if (err) {
            return res.status(404).send({ message: 'File not found' });
        }
        // console.log('File stats:', stats);
        res.status(200).send({ success: true, data: stats });
    });
});

// 删除文件
app.post('/api/deleteFile', (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).send({ success: false, message: 'Unauthorized' });
    }
}, (req, res) => {
    const filename = req.body.filename;
    const directoryPath = path.join(__dirname, 'app');
    fs.unlink(path.join(directoryPath, filename), (err) => {
        if (err) {
            return res.status(500).send({ success: false, message: 'Unable to delete file' });
        }
        console.log('File deleted:', filename);
        res.status(200).send({ success: true, message: 'File deleted' });
    });
});

app.get('/api/getAppNames', (req, res) => {
    const directoryPath = path.join(__dirname, 'app');
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return res.status(500).send({ message: 'Unable to scan directory: ' + err });
        }
        // Check if directory is empty
        if (files.length === 0) {
            return res.status(200).send({ success: false, message: '服务器中没有文件可供下载！' });
        }
        // If directory is not empty, return the filenames
        res.status(200).send({ success: true, data: files });
    });
});

app.get('/api/downloadApp/:filename', (req, res) => {
    const directoryPath = path.join(__dirname, 'app');
    const filename = req.params.filename;
    // Check if file exists
    fs.access(path.join(directoryPath, filename), fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send({ message: '文件不存在！' });
        }
        // If file exists, download the file
        const file = path.join(directoryPath, filename);
        res.download(file, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(500).send({ message: '无法下载文件。' + err });
                } else {
                    console.error('无法下载文件。' + err);
                    res.end();
                }
            }
        });
    });
});

async function sendPushMessage(title, content) {
    try {
        const url = "https://cx.super4.cn/push_msg";
        const params = {
            appkey: process.env.CHUAN_XI,
            title: title,
            content: content
        };

        const response = await axios.get(url, { params, timeout: 10000 });

        if (response.data.code === 200 && response.data.message === "success") {
            return { success: true, message: "发送成功" };
        } else {
            return { success: false, message: "测试发送异常, 请联系管理员" };
        }
    } catch (error) {
        console.error(error);
        return { success: false, message: "请求失败， 请联系管理员" };
    }
}

async function sendEmail(title, content) {
    try {
        // 创建一个 SMTP 客户端配置
        let transporter = nodemailer.createTransport({
            host: 'smtp.qq.com', // 你的 SMTP 服务器地址
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: '710297266@qq.com', // 你的邮箱账号
                pass: process.env.TENCENT_MAIL_TOKEN // 你的authorization code
            }
        });
        // 设置邮件内容（谁发送的、发送给谁、主题、正文）
        let mailOptions = {
            from: '"Node Server Bot" <710297266@qq.com>', // 发送者邮箱
            to: '710297266@qq.com', // 接收者邮箱，多个邮箱地址用逗号隔开
            subject: title, // 主题
            text: content, // 正文
            html: '' // HTML 正文
        };

        // 发送邮件
        let info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error(error);
    }
};

async function getBatteryInfo() {
    try {
        // const batteryInfo = execSync('termux-battery-status | jq \'.percentage\'').toString();
        const batteryInfo = JSON.parse(execSync('termux-battery-status').toString());
        return batteryInfo;
    } catch (error) {
        console.error(error);
        return '获取电池信息失败';
    }
}

app.get('/api/checkServerStatus', async (req, res) => {
    try {
        const batteryInfo = await getBatteryInfo();
        res.status(200).send({ success: true, message: JSON.stringify(batteryInfo) });
    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: '服务器异常' });
    }
});

app.post('/send', (req, res) => {
    // 获取请求体中的 'info' 字段
    const info = req.body.info;

    // 在这里处理你的 'info' 数据...
    console.log(info);
    // 响应请求
    res.json({ message: 'Success', received: info });
});


// let browserHuya = null;
// let allResults = [];
// let nextResults = [];
// let huyaClose = false;

// app.get('/startHuya', async (req, res) => {
//     const homeNum = req.query.homeNum;
//     console.log(homeNum);
//     // Check if homeNum exists and is a number
//     if (!homeNum || isNaN(homeNum)) {
//         res.status(400).send('Invalid homeNum');
//         return;
//     }

//     try {
//         // If there is an existing browser instance, close it
//         if (browserHuya) {
//             await browserHuya.close();
//         }
//         browserHuya = await puppeteer.launch();
//         const page = await browserHuya.newPage();

//         await page.goto('https://www.huya.com/' + homeNum);

//         let previousText = '';
//         res.send('Browser started');
//         // Continuously print the new innerText of #js-barrage-list and #js-barrage-extendList
//         while (true) {
//             const currentText = await page.evaluate(() => {
//                 const ul = document.querySelector('#chat-room__list');
//                 return ul ? ul.innerText : '';
//             });

//             if (currentText !== previousText) {
//                 const newText = currentText.replace(previousText, '');
//                 let info = newText.split('\n\n');

//                 for (let i = 0; i < info.length; i++) {
//                     if (info[i].startsWith(':')) {
//                         let msg = info[i - 1] + info[i];
//                         allResults.push(msg);
//                         nextResults.push(msg);
//                     }
//                 }

//                 previousText = currentText;
//             }

//             // Wait for a while before the next iteration to reduce CPU usage
//             await new Promise(resolve => setTimeout(resolve, 1000));
//         }
//     } catch (error) {
//         console.error(error);
//         if (!res.headersSent) {
//             res.status(500).send('An error occurred');
//         }
//     }
// });

// app.get('/stopHuya', async (req, res) => {
//     if (!browserHuya) {
//         res.status(400).send('No browser instance');
//         return;
//     }
//     huyaClose = true;
//     try {
//         await browserHuya.close();
//         browserHuya = null;
//         res.send('Browser closed');
//         return;
//     } catch (error) {
//         console.error(error);
//         if (!res.headersSent) {
//             res.status(500).send('An error occurred');
//         }
//     }
// });

// app.get('/pollResults', (req, res) => {
//     if (browserHuya && !huyaClose) {
//         const newResults = nextResults;
//         nextResults = [];
//         res.json(newResults);
//     }
// });

// 斗鱼直播
// (async () => {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();

//     await page.goto('https://www.douyu.com/12313');

//     let previousText = '';
//     let previousExtendText = '';

//     // Continuously print the new innerText of #js-barrage-list and #js-barrage-extendList
//     while (true) {
//         const { currentText, currentExtendText } = await page.evaluate(() => {
//             const ul = document.querySelector('#js-barrage-list');
//             const extendUl = document.querySelector('#js-barrage-extendList');
//             return {
//                 currentText: ul ? ul.innerText : '',
//                 currentExtendText: extendUl ? extendUl.innerText : ''
//             };
//         });

//         if (currentText !== previousText) {
//             const newText = currentText.replace(previousText, '');
//             // console.log('New text in #js-barrage-list:', newText);
//             console.log(chalk.green(newText));
//             previousText = currentText;
//         }

//         if (currentExtendText !== previousExtendText) {
//             const newExtendText = currentExtendText.replace(previousExtendText, '');
//             // console.log('New text in #js-barrage-extendList:', newExtendText);
//             console.log(chalk.blue(newExtendText));
//             previousExtendText = currentExtendText;
//         }

//         // Wait for a while before the next iteration to reduce CPU usage
//         await new Promise(resolve => setTimeout(resolve, 1000));
//     }
// })();


// 虎牙直播
// (async () => {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();

//     await page.goto('https://www.huya.com/172163');

//     let previousText = '';

//     // Continuously print the new innerText of #js-barrage-list and #js-barrage-extendList
//     while (true) {
//         const currentText = await page.evaluate(() => {
//             const ul = document.querySelector('#chat-room__list');
//             return ul ? ul.innerText : '';
//         });
//         // let info = currentText.split('\n\n');
//         // info.pop();
//         // info = info.join('\n');
//         if (currentText !== previousText) {
//             const newText = currentText.replace(previousText, '');
//             // console.log('New text in #js-barrage-list:', newText);
//             let info = newText.split('\n\n');
//             // let other = [];
//             for (let i = 0; i < info.length; i++) {
//                 if (info[i].startsWith(':')) {
//                     // 把前后两个拼接到一起
//                     info[i] = info[i - 1] + info[i];
//                     console.log(chalk.red(info[i]));
//                     // } else {
//                     //     other.push(info[i]);
//                 }
//                 // console.log(chalk.green(info[i]));
//             }
//             // console.log(chalk.green(other.join('\n')));
//             previousText = currentText;
//         }
//         // Wait for a while before the next iteration to reduce CPU usage
//         await new Promise(resolve => setTimeout(resolve, 1000));
//     }
// })();



// 抖音抓取必须使用有头模式
// (async () => {
//     const browser = await puppeteer.launch({ headless: false });  // Run browser in headful mode
//     const page = await browser.newPage();
//     await page.goto('https://live.douyin.com/539169864202');

//     // Wait for the div to appear
//     await page.waitForFunction(() => {
//         return !!document.getElementsByClassName('webcast-chatroom___items')[0];
//     }, { timeout: 60000 });  // Wait for up to 60 seconds

//     let lastInnerText = '';
//     setInterval(async () => {
//         const newInnerText = await page.evaluate(() => {
//             const targetNode = document.getElementsByClassName('webcast-chatroom___items')[0];
//             return targetNode.innerText;
//         });
//         let info = newInnerText.split('\n');
//         info.pop();
//         info = info.join('\n');
//         if (info !== lastInnerText) {
//             console.log(info.replace(lastInnerText+'\n', ''));
//             lastInnerText = info;
//         }
//     }, 1000);
// })();


