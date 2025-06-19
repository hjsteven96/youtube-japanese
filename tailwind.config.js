/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}", // app 디렉토리 사용 시
        "./pages/**/*.{js,ts,jsx,tsx,mdx}", // pages 디렉토리 사용 시
        "./components/**/*.{js,ts,jsx,tsx,mdx}", // components 폴더가 있다면 추가

        // Or if using `src` directory:
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};
