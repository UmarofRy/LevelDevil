import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo, FSInputFile

# --- SOZLAMALAR ---
TOKEN = "8483358307:AAEjWziHWTOeTPNxg56yRyZGoVawaM0QSRw"
GAME_URL = "https://leveldevil.onrender.com" 

# Loglarni yoqish
logging.basicConfig(level=logging.INFO)

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start_handler(message: types.Message):
    # Tugma
    markup = types.InlineKeyboardMarkup(inline_keyboard=[
        [
            types.InlineKeyboardButton(
                text="🎮 O'yinni Boshlash (Start)", 
                web_app=WebAppInfo(url=GAME_URL)
            )
        ],
        [
            types.InlineKeyboardButton(
                text="👥 Do'stlarni chaqirish",
                switch_inline_query=" O'ynaymizmi?"
            )
        ]
    ])
    
    # Rasm bilan javob berish (O'yinning logotipi bo'lsa zo'r bo'ladi)
    # Agar rasm bo'lmasa, shunchaki matn chiqaradi.
    # Bu yerda biz chiroyli matnli bezak ishlatamiz:
    
    text = (
        "<b>😈 LEVEL DEVIL: Multiplayer</b>\n\n"
        "Do'stingiz bilan bir vaqtda kiring va tuzoqlardan o'ting!\n"
        "Kim birinchi marraga yetib borarkin?\n\n"
        "👇 <b>Pastdagi tugmani bosing:</b>"
    )

    await message.answer(text, reply_markup=markup, parse_mode="HTML")

async def main():
    print("Bot ishga tushdi...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())