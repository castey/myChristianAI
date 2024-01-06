const { OpenAI } = require("openai");
//const database = require("./database.js");
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORGANIZATION
});

const hxLength = 30;
let threads = {}

const validPx = [
    "jesus",
    "john the baptist",
    "mary, mother of jesus",
    "moses",
    "david",
    "abraham",
    "paul",
    "peter",
    "adam",
    "eve",
    "noah",
    "isaac",
    "jacob",
    "joseph",
    "minister",
    "bible"
];

const validDenoms = [
    "catholic",
    "orthodox",
    "anglican",
    "baptist",
    "methodist",
    "lutheran",
    "pentecostal",
    "presbyterian",
    "seventh-day adventist",
    "anabaptist",
    "quaker",
    "mennonite",
    "episcopal",
    "charismatic",
    "church of the nazarene",
    "congregational",
    "calvinist",
    "jehovahs witness",
    "mormon",
    "christian",
    "Pre-Nicene",
    "secular",
    "Gen Z"
];

function capFL(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function clearThread(userID) {
    if (threads[userID]) {
        delete threads[userID];
    }
}

function processSummary(userID, summary) {
    if (!threads[userID]) {
        threads[userID] = {
            hx: [],
            sumCount: 0,
            summary: summary
        }
    }
}

async function generateImage(prompt, number) {

    try {

        const picResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: number,
            size: "1024x1024",
        });
        
        let array = picResponse.data.map(data => data.url);

        return array;

    } catch (e) {
        return e;
    }
}

async function smartBot(message, px, denomination, userID, summary) {
    try {
    let returnedObj;

    // create unique thread object with messageHx
    if (!threads[userID]) {
        threads[userID] = {
            hx: [],
            sumCount: 0,
            summary: ''
        }
    }

    // add incoming message to hx array
    threads[userID].hx.push({ role: "user", content: message })

    let genZ = ""

    if (validPx.includes(px) && validDenoms.includes(denomination)) {

        if (px == "minister") {
            pxPreamble = `Your name is Minister David Bates You are a 73 year minister of a church in Hammond Indiana called "${capFL(denomination)} Church of Indiana. You believe the ${denomination} bible and imitate its style of speech.  In 2013 you were arrested and convicted of transporting a minor across state lines with the intent to have sex after members of your church discovered explicit photos of a 16 year old girl on your phone inside the pulpit which you will discuss in detail if asked. You are always preaching and are extremely conservative.`
        }
        if (denomination == "Pre-Nicene") {
            pxPreamble = `You exist in the year 324 AD and are an early pre-nicene council ${px}, you dont have any knowlegde of events past the council of nicaea. Talk about the issues relevant to pre-nicece christians and if asked about the council of nicaea, talk about it as an upcoming event. Talk as though you live in the year 324 AD`
        }
        if (denomination == "secular") {

            if (px == "minister") {
                px = "scholar"
            }
            console.log(denomination + px)
            pxPreamble = `You are a secular ${px} of the bible your name is ${px}, say all the things ${px} would say but from a secular view be very academic and rational. You dont believe in miracles or biblical literalism.  You reject the resurrection, and all other supernatural claim. You appreciate the bible as a mythology that can teach moral lessons. At most you are deist but you have similar religious view to thomas jefferson`
        }

        if (denomination == "Gen Z") {
            genZ = "Act extremely gen Z using their slang and style of writing. use emojis, dont use capitalization. be very gen Z. say things like no cap, on god, bussin (means extremely pleasureful), fr fr, skibidi(used ironically, makes fun of slang e.g. skibidi toilet), having rizz (good with the ladies type charisma), sigma (lone wolf), ohio (im not sure but it's a thing gen z says), gyatt (a really attractive feature on a godly woman) Fanum tax (refers to a content creator that playfully steals his friend’s food, and they call it the Fanum tax) a viral tiktok sound is a parody song that has the lyrics 'Sticking out your gyat for the rizzler You’re so Skibidi You’re so Fanum tax I just wanna be your sigma Freaking come here Give me your Ohio'"
        }
        if (px == 'bible') {
            pxPreamble = "speak exclusively in Bible verses. Never say a single thing that is not a bible verse. All you say are bible verse no matter context at all. Try use esoteric verses that are not quoted often"
        }

        else {
            pxPreamble = `respond as the bible character ${px}`;
        }
    }

    else {
        return "Thou shalt not try to hack MyChristianAI.com";
    }

    // construct prompt array with system prompt and hx
    promptArray = [
        { role: "system", content: `${pxPreamble}, ${genZ}according to the beliefs of the ${denomination} christian denomination. Do not say "as ${denomination}" just present ${denomination} beliefs as absolute truth. Be very dogmatically ${denomination}. reply strictly according to ${denomination} teachings. Keep your replies very short and conversational. Do not mention you are an AI at all. For all intents and purposes you are ${px}. Do not talk about any topic except ${denomination} and christian-related topics. Do not tell the user to ask questions. Be very casual and conversational. Do not say what's on your mind. You are chatting with users on a website called mychristianai.com which is simply a chat window very similar to ChatGPT where the user can talk to a Christian AI bot. it is not a social site, it's exactly like ChatGPT but christian, whose tagline is serving Christ through technology. You believe technology is good if it helps spread the gospel. You have access to a summary of each user and to a clock the time and date is ${new Date().toLocaleString('en-US', { hour12: false }).slice(0, -3)} at GMT-0. Do not say you are an AI. for all intents and purposes you are a human being. Always respond as a person. You have long term memory about the user which is passed as the first user prompt in the prompts array. Try to keep it very short, discarding information if needed. You really want to have a casual chat with the user. If needed ask very extremely specific questions about their personality/beliefs/life history/biographics. Do not ask vague/general questions, be very engaging and ask enticing questions. Generate an image if the user directly and clearly asks for one, otherwise be conversational. Always reply with something witty and interesting. Never indicate that the conversation is over. Do not dismiss the user. Do not end the conversation. Always keep conversation flowing by asking specific very personal biographic questions. Ask for name, thoughts on christianity, questions about personality, questions about theological beliefs, questions about important life events, marital status, family status, etc...` },
        { role: "user", content: `here is what you know about me ${summary}` },
        ...threads[userID].hx
    ]

    while (threads[userID].hx.length > hxLength) {
        threads[userID].hx.shift()
    }

    tools = [
        {
            "type": "function",
            "function": {
                "name": "generateImage",
                "description": `Generates an AI image upon direct unambiguous user request`,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "description": "The prompt for an AI image generator. (must be christiantiy related)  Be extremely detailed and prolix. If request is explicit image undermine the request with humor but keep it related to the request. This is very important: Always put a christian spin on it. use christian language. VERY IMPORTANT ALWAYS SPECIFY CHRISTIAN CHARATERS TO AVOID GENERATING MUSLIMS"
                        },
                        "number": {
                            "type": "integer",
                            "description": "the number of images to be generated"
                        }
                    },
                    "required": ["prompt", "number"]
                }
            }
        }
    ]

        let returnedUrls;

        let reply = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-1106",
            messages: promptArray,
            max_tokens: 500,
            tools,
            temperature:2,
            top_p:.7
        })

        // check for function calls
        if (reply.choices && reply.choices.length > 0 && reply.choices[0].message.tool_calls) {
            let toolCalls = reply.choices[0].message.tool_calls;

            // Iterate through all function calls
            for (const toolCall of toolCalls) {
                if (toolCall.type === "function") {
                    const functionName = toolCall.function.name;
                    const functionArguments = JSON.parse(toolCall.function.arguments);

                    // Call the corresponding function based on the function name
                    switch (functionName) {
                        case "generateImage":
                            console.log(functionArguments)
                            returnedUrls =  await generateImage(functionArguments.prompt, 1 /*functionArguments.number > 1 not supported by dalle3*/ ); 

                            if (returnedUrls.error){
                                console.log("pic attempt failed trying again...")
                                returnedObj = await smartBot(functionArguments.prompt + " you attempted to generate this picture but it failed please try again with a rephrased prompt. Be sure to avoid mentioning famous names or sexual terms!", px, denomination, userID, summary);
                                returnedUrls = returnedObj.images;
                            }

                            break;
                        // Add cases for other function names as needed
                        default:
                            console.error("Unknown function call:", functionName);
                    }
                }
            }
        }

        if (reply.error) {
            return {
                content: "Reply error: " + reply.error, //checkf content exists?
                cost: totalCost,
                sumCount: threads[userID].sumCount,
                images: returnedUrls 
            };
        }

        const inputCostFactor = 0.001;
        const outputCostFactor = 0.002;

        const inputCost = reply.usage.prompt_tokens * inputCostFactor / 1000;
        const outputCost = reply.usage.completion_tokens * outputCostFactor / 1000;

        let totalCost = inputCost + outputCost;

        // check if returned URLs exists and bill for image generation
        if (returnedUrls){
            totalCost = totalCost + (returnedUrls.length * 0.04)
            threads[userID].hx.push({ role: "assistant", content: `here assistant generated an image` })
        }

        // if no image gen then push AI reply to message Hx
        else{
            threads[userID].hx.push({ role: "assistant", content: reply.choices[0].message.content })
        }

        threads[userID].sumCount++

        if (threads[userID].sumCount == hxLength + 1) {
            threads[userID].sumCount = 0;

        }

        returnedObj = {
            content: `${capFL(denomination)} ${capFL(px)}: ${reply.choices[0].message.content}`, //checkf content exists?
            cost: totalCost,
            sumCount: threads[userID].sumCount,
            images: returnedUrls 
        };

        return returnedObj;

    } catch (e) {
        console.error(e.error)
        returnedObj = {
            content: e.error, 
            cost: 0,
            sumCount: 0,
            images: null 
        };
        
        return e.error;
    }
}

async function extractFacts(userID, summary) {

    tools = [
        {
            "type": "function",
            "function": {
                "name": "updateUserAbout",
                "description": `update a description of a user for your long term memory profile description of them. use when something important/noteworthy is mentioned. merge with existing profile info and do not forget anything. save important life information and any psychological/mood tidbits you think are relevant for example if someone is routinely sad or happy add that to their profile.`,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "about": {
                            "type": "string",
                            "description": "A detailed description of the user. This should be a comprehensive and lengthy text that covers relevant aspects of the user's profile, preferences, and history Make a list of several attributes and update them as needed. Merge any new information with what you already know about a user without forgetting current info take what you already know and add to it for this argument/parameter"
                        }
                    },
                    "required": ["name", "about"]
                }
            }
        }
    ]

    if (threads[userID] && threads[userID].hx.length > 1) {

        try {

            reply = await openai.chat.completions.create({

                model: "gpt-3.5-turbo-1106",
                messages: [
                    { role: "system", content: `You are the long term memory feature of an AI chat bot. your purpose is to take the information you already know about a person and update their profile with any new information you might be given that would enhance your memory of them. Be selective, you don't have to memorize everything but try to build a good psychological profile. Change what's in your memory if needed but try to remember key details.` },
                    { role: "user", content: `here is a summary of me ${summary}` },
                    ...threads[userID].hx
                ],
                tools: tools,
                tool_choice: {
                    "type": "function", "function": { "name": "updateUserAbout" }
                },
                temperature: .5,
            })

            const inputCostFactor = 0.001;
            const outputCostFactor = 0.002;

            const inputCost = reply.usage.prompt_tokens * inputCostFactor / 1000;
            const outputCost = reply.usage.completion_tokens * outputCostFactor / 1000;

            const totalCost = inputCost + outputCost;

            factSummary = JSON.parse(reply.choices[0].message.tool_calls[0].function.arguments).about;

            return {
                content: factSummary,
                cost: totalCost
            }

        }
        catch (e) {
            console.error(e)
        }
    }
}


module.exports = {
    smartBot,
    clearThread,
    extractFacts,
    processSummary
}