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
        // await checkTokensFromFile(page, path.join(__dirname, '../', 'tokens.txt'));
        console.log(chalk.green('Программа закончила свое выполнение!'));
    } catch (err) {
        // browser.close();
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
            }, 1500);
        }, credentials);

        await page.waitForSelector('#wb_auto_blend_container');
        await page.evaluate(() => {
            let authKey = null;
            fetch('https://redeem.microsoft.com/webblendredeem?lang=en-US&market=US&control=redeem&mock=false&metadata=mscomct&lang=en-US&cid=45dde1e9c4e53251&xhr=true&X-Requested-With=XMLHttpRequest&_=1578415732613', {
                credentials: 'include',
                ':authority': 'redeem.microsoft.com',
                ':method': 'GET',
                ':path': '/webblendredeem?lang=en-US&market=US&control=redeem&mock=false&metadata=mscomct&lang=en-US&cid=45dde1e9c4e53251&xhr=true&X-Requested-With=XMLHttpRequest&_=1578415732613',
                ':scheme': 'https',
                'accept': 'application/json, text/javascript, */*; q=0.01'
            }).then(res => res.json())
                .then(data => {
                    authKey = data.metadata.mscomct;
                    console.log('WLID1.0="' + authKey + '"');

                    fetch(`https://purchase.mp.microsoft.com/v7.0/tokenDescriptions/4TPCC-6F7PV-34VFH-7C4DW-3XD6Z?market=RU&language=en-US&supportMultiAvailabilities=true`, {
                        headers: {
                            'Authorization': 'WLID1.0="' + authKey + '"',
                        },
                    }).then((res) => {
                        return res.json();
                    }).then((data) => {
                        console.log(data);
                    })
                });
        });
        const srcIframe = await page.$eval('#wb_auto_blend_container', iframe => iframe.src);
    } catch (err) {
        throw err;
    }
}
