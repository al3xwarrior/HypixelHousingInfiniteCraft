const mineflayer = require('mineflayer');
const { askChatGPT } = require('./chatGPT');
const Item = require('prismarine-item')('1.8');
const fs = require('fs');
const Players = JSON.parse(fs.readFileSync("./players.json"));
const Items = JSON.parse(fs.readFileSync("./items.json"));
const ItemIDs = JSON.parse(fs.readFileSync("./itemids.json"));

const options = {
    host: 'hypixel.net',
    username: 'USER',
    password: 'PASS',
    auth: 'microsoft',
    version: '1.8.9',
};

const bot = mineflayer.createBot(options);

let joinedPlayer = "";
let actions = [];
let chatGPTQueue = [];
let processingChatGPT = false;

async function handleBotMessages(msg) {
    let obj = msg.split(" ")[2];
    obj = JSON.parse(obj);
    console.log(obj);

    switch (obj.type) {
        case "NEW_CRAFT":
            const data = obj.data;
            const plrid = data.PLRID;
            try {
                const id1 = data.ID1;
                const id2 = data.ID2;
                const item1 = ItemIDs[id1];
                const item2 = ItemIDs[id2]

                console.log(`New Item Recieved: ${ItemIDs[id1]} + ${ItemIDs[id2]} from Player#${plrid}`);

                let createdBefore = false
                for (const [key, value] of Object.entries(Items)) {
                    if (key === `${item1}+${item2}` || key === `${item2}+${item1}`) {
                        createdBefore = true;
                        break;
                    }
                }
                console.log("Was this item created before? " + createdBefore)

                // item data
                let gptITEM;
                let name;
                let lore;
                let enchants;

                // Has the item been created before?
                if (createdBefore) {
                    // get the item from the cache
                    let item;
                    if (Items[`${item1}+${item2}`]) item = Items[`${item1}+${item2}`];
                    if (Items[`${item2}+${item1}`]) item = Items[`${item2}+${item1}`];
                    item.amountMade += 1;
                    let newItem = item.itemData;
                    console.log(JSON.stringify(newItem));

                    // create the actual minecraft item
                    gptITEM = new Item(newItem[0], 1, 0)

                    // apply data from ai result
                    name = newItem[2];
                    lore = newItem[3].split("<newline>");
                    lore.push("");
                    lore.push(`§8Created By: ${(Players[plrid]) ? `§7${Players[plrid]}` : `§7Player#${plrid}`}`);
                    lore.push(`§8Serial Number: §7${item.amountMade}`);
                    lore.push(`§8---------------------------------`);
                    lore.push(`§8Original Creator: ${(Players[item.createdBy]) ? `§7${Players[item.createdBy]}` : `§7Player#${plrid}`}`);
                    enchants = newItem[4];
                } else {
                    // add to chatGPTQueue
                    chatGPTQueue.push({ item1, item2, plrid });
                }

                // apply data to item
                if (gptITEM) {
                    gptITEM.customName = name;
                    gptITEM.customLore = lore;
                    gptITEM.enchants = enchants;

                    // push to the actions for a queue
                    actions.push({
                        item: gptITEM,
                        player: Players[plrid],
                        lore: lore
                    })

                    console.log("Successfully Created!");
                    fs.writeFileSync("./items.json", JSON.stringify(Items, null, 2));
                    console.log("Cached Item!")
                }
            } catch (error) {
                console.log("Error! " + error);
                console.log(`/erroroccured ${Players[plrid]}`)
                bot.chat(`/erroroccured ${Players[plrid]}`);
            }

            break;
        case "PLAYER_JOIN":
            // %stat.global/plridforbc%
            const id = parseInt(obj.id);
            if (Players[id]) return console.log(`${joinedPlayer} already logged as #${id}`);
            Players[id] = joinedPlayer;
            console.log(`Logged Player ${joinedPlayer} as #${id}`);
            fs.writeFileSync("./players.json", JSON.stringify(Players, null, 2));
            console.log("Cached Player!");
            bot.chat("/joinlogged " + joinedPlayer);
            console.log("Player granted access to house!");
            break;
    }
}

async function processChatGPTQueue() {
    if (processingChatGPT || chatGPTQueue.length === 0) return;

    processingChatGPT = true;
    const { item1, item2, plrid } = chatGPTQueue.shift();

    try {
        let newItem = await askChatGPT(item1, item2);
        // parse result as a Object
        newItem = JSON.parse(newItem.choices[0].message.content);
        console.log(JSON.stringify(newItem));

        // update the items list to cache the new item
        Items[`${item1}+${item2}`] = {
            "itemData": newItem,
            "amountMade": 1,
            "createdBy": plrid,
            "firstMadeTime": Date.now()
        }

        // create the actual minecraft item
        let gptITEM = new Item(newItem[0], 1, 0)

        // apply data from ai result
        let name = newItem[2];
        let lore = newItem[3].split("<newline>");

        const rarity = lore[lore.length-1];
        console.log(rarity)
        // "§7§lCOMMON", "§a§lUNCOMMON", "§9§lRARE", "§d§lEPIC", "§6§lLEGENDARY", "§4§kB§r §c§lMYTHIC §4§kB"
        if (rarity.includes("LEGENDARY")) bot.chat('/newlegendary');
        else if (rarity.includes("MYTHIC")) bot.chat('/newmythic');      
        else if (rarity.includes("UNCOMMON")) bot.chat('/newuncommon');      
        else if (rarity.includes("COMMON")) bot.chat('/newcommon');      
        else if (rarity.includes("RARE")) bot.chat('/newrare');      
        else if (rarity.includes("EPIC")) bot.chat('/newepic');      

        lore.push("");
        lore.push(`§8Created By: ${(Players[plrid]) ? `§7${Players[plrid]}` : `§7Player#${plrid}`}`);
        lore.push(`§8Serial Number: §7${Items[`${item1}+${item2}`].amountMade}`);
        lore.push(`§8---------------------------------`);
        lore.push(`§8Original Creator: ${(Players[plrid]) ? `§7${Players[plrid]}` : `§7Player#${plrid}`}`);
        let enchants = newItem[4];

        // apply data to item
        gptITEM.customName = name;
        gptITEM.customLore = lore;
        gptITEM.enchants = enchants;

        // push to the actions for a queue
        actions.push({
            item: gptITEM,
            player: Players[plrid]
        })

        console.log("Successfully Created!");
        fs.writeFileSync("./items.json", JSON.stringify(Items, null, 2));
        console.log("Cached Item!")
    } catch (error) {
        console.log("Error! " + error);
        console.log(`/erroroccured ${Players[plrid]}`)
        bot.chat(`/erroroccured ${Players[plrid]}`);
    } finally {
        processingChatGPT = false;
        processChatGPTQueue();
    }
}

bot.on('spawn', () => {
    setTimeout(() => {
        console.log("/visit Al3xWarrior")
        bot.chat('/visit Al3xWarrior');
    }, 2000);
});

bot.on("windowOpen", (window) => {
    console.log("Window Opened");
    setTimeout(() => {
        const items = window.slots;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(item);
            if (item != null) {
                if (item.displayName == "Ender Chest") {
                    console.log("Clicking slot " + item.slot);
                    bot.clickWindow(item.slot, 1, 0).catch(() => {});
                    break;
                }
            }
        }
    }, 2000);
});

bot.on('message', (jsonMSG) => {
    if (jsonMSG.getText().startsWith("* BOT_MESSAGE ")) {
        handleBotMessages(jsonMSG.getText());
        return;
    }

    if (jsonMSG.getText().endsWith(" entered the world.")) {
        const split = jsonMSG.getText().split(" ");
        if (split[0].includes("[")) {
            joinedPlayer = split[1];
        } else {
            joinedPlayer = split[0];
        }
        console.log("Joined Player: " + joinedPlayer);
        return;
    }

    if (jsonMSG.getText().includes("invited you to warp to their home.")) bot.chat("/housing invite accept 83d72b6f-4a29-4680-9587-42524c920bbc");
});

setInterval(async () => {
    if (actions.length < 1) return;

    const itemInformation = actions[0];
    /*{
        item: gptITEM,
        player: Players[plrid]
    }*/
    try {
        console.log("Giving Item");
        console.log("Item Information:", itemInformation);

        if (!itemInformation.item || !itemInformation.item.type || itemInformation.item.name === 'unknown') {
            bot.chat(`/erroroccured ${itemInformation.player}`);
            actions.shift();
            return;
        }

        bot.creative.setInventorySlot(36, itemInformation.item);
        await bot.waitForTicks(4);

        console.log("Throw Item");
        await bot.toss(itemInformation.item.type, null, 1);
        await bot.waitForTicks(38);

        console.log("Tp Player");
        bot.chat(`/tptome ${itemInformation.player}`);
    } catch (error) {
        console.error("Error during item toss or player TP:" + error);
        bot.chat(`/erroroccured ${itemInformation.player}`);
    }

    actions.shift();
}, 5000);


setInterval(processChatGPTQueue, 200); // check the chatGPTQueue every second
