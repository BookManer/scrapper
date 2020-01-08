const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SITE = 'https://redeem.microsoft.com/?wa=wsignin1.0';

(async () => {
    let browser = null;
    try {
        browser = await puppeteer.launch({headless: false});
        const page = await initPage(browser);
        console.log(chalk.green('Окно создано!'));
        await authMicrosoft(page);
        console.log(chalk.blue('Аутентификация пройдена успешно!'));
        await checkToken(page, path.join(__dirname, '../'));
        console.log(chalk.green('Программа закончила свое выполнение!'));
        browser.close();
    } catch (err) {
        console.log(chalk.red('Что-то пошло не так, где-то ошибочка\n'+err));
    }
})();

async function initPage(browser) {
    const page = await browser.newPage();
    await page.setViewport({
        width: 1386,
        height: 580,
        deviceScaleFactor: 1,
    });

    return Promise.resolve(page);
}

async function authMicrosoft(page) {
    try {
        const credentials = JSON.parse(process.env.CREDENTIALS_USER_MICROSOFT);

        await page.goto(SITE);
        await page.evaluate((credentials) => {
            const { username } = credentials;
            const input_email = document.querySelector('#i0116');
            const btn_next = document.querySelector('#idSIButton9');

            input_email.value = username;
            input_email.dispatchEvent(new Event('input'));
            btn_next.dispatchEvent(new Event('click'));
        }, credentials);

        await page.waitForSelector('#i0118');
        await page.waitForSelector('#idSIButton9');
        await page.evaluate((credentials) => {
            const { password } = credentials;
            const input_password = document.querySelector('#i0118');

            input_password.value = password;
            input_password.dispatchEvent(new Event('input'));
            setTimeout(() => {
                const btn_next = document.querySelector('#idSIButton9');
                btn_next.dispatchEvent(new Event('click'));
            }, 2400);
        }, credentials);

    } catch (err) {
        throw err;
    }
}

async function checkToken(page, pathFile) {
    const validTokens = [];

    console.log(chalk.rgb(30, 247, 200).bold('Подготовка к проверке токенов...'));
    await page.waitForSelector('#wb_auto_blend_container');
    console.log(chalk.rgb(30, 247, 200).bold('Начинаем проверять...'));
    let tokens = await fs.readFileSync(pathFile+'tokens.txt', 'utf-8').split('\n');
    tokens = tokens.slice(0,tokens.length-1);

    const authKey = await page.evaluate(() => {
        const key = fetch('https://redeem.microsoft.com/webblendredeem?lang=en-US&market=US&control=redeem&mock=false&metadata=mscomct&lang=en-US&cid=45dde1e9c4e53251&xhr=true&X-Requested-With=XMLHttpRequest&_=1578415732613', {
            credentials: 'include',
            ':authority': 'redeem.microsoft.com',
            ':method': 'GET',
            ':path': '/webblendredeem?lang=en-US&market=US&control=redeem&mock=false&metadata=mscomct&lang=en-US&cid=45dde1e9c4e53251&xhr=true&X-Requested-With=XMLHttpRequest&_=1578415732613',
            ':scheme': 'https',
            'accept': 'application/json, text/javascript, */*; q=0.01'
        })
            .then(res => res.json())
            .then(data => {
                return data.metadata.mscomct;
            });

        return Promise.resolve(key);
    });
    console.log('authKey = ', chalk.rgb(176, 20, 219).bold(authKey));
    for (let token of tokens) {
        console.log('Проверяем токен: ', chalk.rgb(176, 20, 219).bold(token));
        const res = await page.evaluate((token, authKey) => {
            let resChecker = fetch(`https://purchase.mp.microsoft.com/v7.0/tokenDescriptions/${token}?market=RU&language=en-US&supportMultiAvailabilities=true`, {
                headers: {
                    'Authorization': 'WLID1.0="' + authKey + '"',
                },
            }).then((res) => {
                return res.json();
            }).then((data) => {
                return data;
            });

            return Promise.resolve(resChecker);
        }, token, authKey);

        if (res.tokenState === "Redeemed") {
            console.log(chalk.red('====== Этот токен, к сожалению, использованный ======'));
        } else {
            validTokens.push(token+'\n');
            console.log(chalk.green('====== Этот токен будет записан в результирующий файл ======'));
        }
    }

    console.log(validTokens.join(''));
    await fs.writeFileSync(pathFile+'validTokens.txt', validTokens.join(''))

}
