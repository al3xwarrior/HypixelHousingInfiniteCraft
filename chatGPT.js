const fs = require('fs');
const instructions = fs.readFileSync("./chatgptInstructions.txt");
const itemIDS = fs.readFileSync("./itemids.json");
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: "API KEY" });

async function askChatGPT(item1, item2) {
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { 
                role: "system", 
                content: `${instructions} | ITEM1: ${item1} ITEM2: ${item2}`
            }
        ],
        temperature: 0.8
    });
    //console.log(completion);
    return completion;
}

module.exports = {
    askChatGPT,
}