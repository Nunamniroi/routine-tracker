// Після перетягування браузер іноді «доклацує» по елементу під пальцем — ігноруємо такі кліки.
let until = 0
export const markDragEnd = () => { until = Date.now() + 400 }
export const justDragged = () => Date.now() < until
