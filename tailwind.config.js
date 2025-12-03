/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Cypherpunk palette
                neon: {
                    green: '#39ff14',
                    purple: '#bc13fe',
                    blue: '#04d9ff',
                },
                dark: {
                    bg: '#0a0a0a',
                    surface: '#121212',
                    border: '#333333',
                }
            },
            fontFamily: {
                mono: ['"Fira Code"', 'monospace'], // Cypherpunk vibe
            }
        },
    },
    plugins: [],
}
