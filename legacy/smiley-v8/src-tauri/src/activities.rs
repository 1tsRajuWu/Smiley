use crate::models::{Activity, Category};

fn a(
    id: &str,
    details: &str,
    state: &str,
    emoji: &str,
    category: &str,
    color: &str,
    gif: &str,
) -> Activity {
    Activity {
        id: id.into(),
        details: details.into(),
        state: state.into(),
        emoji: emoji.into(),
        category: category.into(),
        color: color.into(),
        gif: gif.into(),
    }
}

pub fn categories() -> Vec<Category> {
    let food = "#f7768e";
    let gaming = "#7aa2f7";
    let chill = "#9ece6a";
    let work = "#bb9af7";
    let social = "#ff9e64";

    let gaming_gif = "https://media.tenor.com/yjGe52tfF-wAAAAM/gaming-gamer.gif";
    let chill_gif = "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif";
    let work_gif = "https://media.tenor.com/QLh0PhunTj8AAAAM/anime-typing.gif";
    let social_gif = "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif";

    vec![
        Category {
            id: "food".into(),
            label: "Food".into(),
            emoji: "🍽️".into(),
            color: food.into(),
            activities: vec![
                a("eating-pizza", "Eating", "Pizza night 🍕", "🍕", "food", food, "https://media.tenor.com/i-xS-A_DTCEAAAAM/pizza-food.gif"),
                a("eating-sushi", "Eating", "Sushi run 🍣", "🍣", "food", food, "https://media.tenor.com/KE361QFenNcAAAAM/anime-refei%C3%A7%C3%A3o-jap%C3%A3o-comida.gif"),
                a("eating-ramen", "Eating", "Ramen bowl 🍜", "🍜", "food", food, "https://media.tenor.com/3hCp28Y4JcUAAAAM/hungry-ramen.gif"),
                a("eating-burger", "Eating", "Burger time 🍔", "🍔", "food", food, "https://media.tenor.com/uk9xO0xpWoIAAAAM/burger-eating.gif"),
                a("cooking", "Cooking", "Chef mode 👨‍🍳", "👨‍🍳", "food", food, "https://media.tenor.com/flX5arjPeDcAAAAM/sora-cooking.gif"),
                a("eating-dessert", "Eating", "Sweet tooth 🍰", "🍰", "food", food, "https://media.tenor.com/DTRz6D1e5ZEAAAAM/eating-dessert-happily.gif"),
                a("eating-tacos", "Eating", "Taco Tuesday 🌮", "🌮", "food", food, "https://media.tenor.com/tz1kb3yen6wAAAAM/uwu-taco.gif"),
                a("eating-snacks", "Snacking", "Midnight munchies 🍿", "🍿", "food", food, "https://media.tenor.com/gBrP7QayoRkAAAAM/himouto-umaru-chan.gif"),
            ],
        },
        Category {
            id: "gaming".into(),
            label: "Gaming".into(),
            emoji: "🎮".into(),
            color: gaming.into(),
            activities: vec![
                a("gaming", "Gaming", "In the zone", "🎮", "gaming", gaming, gaming_gif),
                a("ranked", "Gaming", "Ranked grind 🔥", "🔥", "gaming", gaming, "https://media.tenor.com/o52AZQZ_PloAAAAM/kick-anime.gif"),
                a("coop", "Gaming", "Co-op with friends", "👥", "gaming", gaming, "https://media.tenor.com/ZIlcnod9hnkAAAAM/anime-anime-hug.gif"),
                a("retro", "Gaming", "Retro classics 🕹️", "🕹️", "gaming", gaming, "https://media.tenor.com/L99ayPjM6m4AAAAM/zyclunt-blue.gif"),
                a("speedrun", "Gaming", "Speedrunning ⏱️", "⏱️", "gaming", gaming, "https://media.tenor.com/V2FWyvBLJ0kAAAAM/anime-run-run.gif"),
                a("vr-gaming", "Gaming", "In VR 🥽", "🥽", "gaming", gaming, "https://media.tenor.com/qIvEeou-1FIAAAAM/play-network-anime-girl.gif"),
            ],
        },
        Category {
            id: "chill".into(),
            label: "Chill".into(),
            emoji: "😌".into(),
            color: chill.into(),
            activities: vec![
                a("sleeping", "Sleeping", "Do not disturb 💤", "💤", "chill", chill, chill_gif),
                a("napping", "Napping", "Power nap mode", "😴", "chill", chill, "https://media.tenor.com/jfwf7xpv5p0AAAAM/sleep-anime.gif"),
                a("reading", "Reading", "Lost in a book 📚", "📚", "chill", chill, "https://media.tenor.com/rJxGy9CYwHoAAAAM/anime-read.gif"),
                a("listening", "Listening to music", "Vibes on 🎵", "🎧", "chill", chill, "https://media.tenor.com/dN976uhxB0kAAAAM/aimoto-rinku-listening-to-music.gif"),
                a("meditating", "Meditating", "Finding peace 🧘", "🧘", "chill", chill, "https://media.tenor.com/7tcxu-UKvO8AAAAM/meditate-zen.gif"),
                a("bath", "Relaxing", "Bubble bath 🛁", "🛁", "chill", chill, "https://media.tenor.com/M3nkdB81tkQAAAAM/virgin-road-anime-relaxed.gif"),
            ],
        },
        Category {
            id: "work".into(),
            label: "Work".into(),
            emoji: "💻".into(),
            color: work.into(),
            activities: vec![
                a("coding", "Coding", "Building something cool", "💻", "work", work, work_gif),
                a("studying", "Studying", "Brain gains 📖", "📖", "work", work, "https://media.tenor.com/etfl8OlhPIYAAAAM/studying-anime-girl.gif"),
                a("meeting", "In a meeting", "Busy until further notice", "📅", "work", work, "https://media.tenor.com/_9W9bVa4AHgAAAAM/wavi-anime.gif"),
                a("focus", "Deep focus", "Heads down 🔒", "🔒", "work", work, work_gif),
                a("designing", "Designing", "Creating art 🎨", "🎨", "work", work, "https://media.tenor.com/GB_tiifwEJ0AAAAM/drawing-kaoruko-moeta.gif"),
                a("writing", "Writing", "Words flowing ✍️", "✍️", "work", work, "https://media.tenor.com/OeaK9o_vzMIAAAAM/anime-write.gif"),
            ],
        },
        Category {
            id: "social".into(),
            label: "Social".into(),
            emoji: "✨".into(),
            color: social.into(),
            activities: vec![
                a("streaming", "Streaming", "Live now 📺", "📺", "social", social, social_gif),
                a("watching", "Watching", "Movie night 🎬", "🎬", "social", social, "https://media.tenor.com/7_IxCInZUPQAAAAM/menhera-eating-popcorn.gif"),
                a("traveling", "Traveling", "On an adventure ✈️", "✈️", "social", social, "https://media.tenor.com/gPjII19ICdIAAAAM/road-road-trip-move-dragon-ball-anime-tyan-vibe-car.gif"),
                a("gym", "At the gym", "Gains incoming 💪", "💪", "social", social, "https://media.tenor.com/uKWmvSxGj3gAAAAM/gym-wow.gif"),
                a("partying", "Partying", "Living my best life 🎉", "🎉", "social", social, "https://media.tenor.com/ymPYRZ4YGbEAAAAM/partyhard-party.gif"),
                a("shopping", "Shopping", "Retail therapy 🛍️", "🛍️", "social", social, "https://media.tenor.com/9M34adQOtNwAAAAM/shopping-hi.gif"),
            ],
        },
    ]
}

pub fn find(id: &str) -> Option<Activity> {
    for c in categories() {
        if let Some(act) = c.activities.into_iter().find(|x| x.id == id) {
            return Some(act);
        }
    }
    None
}
