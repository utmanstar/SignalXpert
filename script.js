async function loadSignals() {
    try {
        const response = await fetch('signals.json');
        const signals = await response.json();
        displaySignals(signals);
    } catch (error) {
        console.error('Error loading signals:', error);
    }
}

function displaySignals(signals) {
    const container = document.getElementById('signalsContainer');
    container.innerHTML = '';

    signals.forEach(signal => {
        const card = document.createElement('div');
        card.className = 'signal-card';
        card.innerHTML = `
            <h3>${signal.pair} (${signal.exchange})</h3>
            <p>📈 Direction: <b>${signal.direction}</b></p>
            <p>⚡ Leverage: ${signal.leverage}</p>
            <p>🎯 Entry: ${signal.entry}</p>
            <p>🏆 Targets: ${signal.targets.join(', ')}</p>
            <p>🛑 Stop Loss: ${signal.stopLoss}</p>
            <p>🤖 AI Score: <b>${signal.aiScore}%</b></p>
        `;
        container.appendChild(card);
    });
}

function generateRandomSignal() {
    const pairs = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT"];
    const directions = ["LONG", "SHORT"];
    const exchanges = ["Binance", "Bybit", "OKX"];

    const signal = {
        pair: pairs[Math.floor(Math.random() * pairs.length)],
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
        direction: directions[Math.floor(Math.random() * directions.length)],
        leverage: `${Math.floor(Math.random() * 20) + 5}X`,
        entry: (Math.random() * 50000 + 1000).toFixed(2),
        targets: [
            (Math.random() * 50000 + 1000).toFixed(2),
            (Math.random() * 50000 + 1000).toFixed(2)
        ],
        stopLoss: (Math.random() * 50000 + 1000).toFixed(2),
        aiScore: Math.floor(Math.random() * 21) + 80
    };

    displaySignals([signal]);
}

document.getElementById('generateBtn').addEventListener('click', generateRandomSignal);

// Load signals on page start
loadSignals();
