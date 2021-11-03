const beacons = [
    {
        name: 'One',
        keyword: 'Beacons_1',
        svg: `<path d="M13 41c-3 0-5-1-7-3l-2-1c-1 0-2 0-2-2-1-1 0-1 1-1l1-1h2l1 1 6 2 3-2 2-5 1-1c3 0 5-3 7-4l1-1c0-2 1-3 3-2l3 1 1 1c1 1 0 2-1 2l-7 4-5 4c0 2-1 4-3 5l-3 2-2 1zm-2-13-8-2c-2 0-3-2-3-4 0-1 1-2 2-1l5 1 5 1c2 1 2 2 2 3l-3 2z" opacity=".2"/>
        <path d="m23 25-2 1-3 6c-2 3-4 3-7 2l-5-1-2-1c-1 0-2 0-1-1l1-2h2c2-1 4-1 4-3l1-1 1-2v-1l-5-1H4l-2-3c0-2 2-3 3-5l7-3c1-1 2 0 3 1l1 1 7 2 1 1 5 2c1 0 2 2 1 3l-2 3-5 2z" fill="#f7aa4c"/>
        <path d="M31 17h-2l-1 1h-4l-1-1v-1l-4-1h-7l-2-2v-1l-1-1-1 1v1c1 3 2 3 5 4-2 1-4 2-5 0l-3-1-2 1-1 2c0 1 2 4 4 3h7l1-1 3-3h1l1-1h1l1 1h-1l-1 1-2 2-1 1v2c-1 2-2 4-5 4l-2 1c-1 2-1 2-2 1H6l-3-1-1 2 1 1h1l2 1 5 2 2 1c2-1 5-2 6-5v-2l2-3 2-1h1l2-1h2l1-3 3-2-1-2zM12 28c2-1 4-2 5-5l3-2v-1h1l1 1c1 1 1 1-1 2s-4 3-5 6l-2 3h-2l-3-1 3-3z" fill="#c2702b"/>
        <path d="m32 17-3-1a5 5 0 0 1-4-1l-1-1a8 8 0 0 0-7-2h-1v-1l-3-3h-1l-1 1c-4 2-7 4-10 8v1l1 3c1 2 2 3 4 2v-1h2l1 1 1 3-1 1-2 1H4l-3 3v2l11 4c1 1 3 0 4-1 2-2 3-3 3-5 1-4 6-7 9-6 2 0 2-1 2-3v-1l1-1 1-3zm-12 9-2 4-3 5h-3l-9-3H2l1-2h3l3-1 2-1v-1l1-2a10 10 0 0 1 4-5l3-1 2 1 5 2 2 1c-3 0-6 1-8 3zm-3-12h2l4 2 1 1a5 5 0 0 0 4 1l1 1-1 1h-1l-6-2h-1v-1h-3l-3 2a14 14 0 0 0-2 3h-1c-2-2-4-2-6-1H4c-2-3-2-2 0-4l1-1 3-3 2-1 1-1c2-1 2-1 3 1v1l3 1z" fill="#f37462"/>`
    },
    {
        name: 'Two',
        keyword: 'Beacons_2',
        svg: `<path d="m34 19 4 2-2 4-13 8-9 5h-4l-6-3H3c-2 0-2-2-1-2l1-2c1-1 2-1 3 1h1l4 2h1l6-3 1-1 2-3 9-3c1 0 2-1 2-3-1-1 1-2 2-2z" opacity=".2"/>
        <path d="M36 18v1l-2 3-3 1-4 1-1 1-3 2h-2l-1 3-2 2-1 1-5 2c-2 0-4-2-5-3l-1-1H4l-2-1v-2a1 1 0 0 1 1-1h2a5 5 0 0 0 1 0c3 0 4 0 5-3a10 10 0 0 1 1-3 11 11 0 0 1 3-3h1l1-1h5l1-1c-1-1 0-2 1-3h2l2-1h2v1h1l2 1h2v1l1 2v1z" fill="#f7aa4c"/>
        <path d="M35 15v-1h-2l-2-1a27 27 0 0 1-6 0h-1l-1 1 1 1h1l1 1-1 2-2 2h-7l-1-1v-1l-2 1v1l-1 1-1 2h2l1-1h1a28 28 0 0 1 2 3l-2 3-4 1H4v2h3l4 4h2l5-1 2-3 1-1v-3h2l2-1 1-1 1-1h3l4-2 1-3v-4zM12 30c4-1 5-1 6-5 0-2 1-2 2-3l8-4v-1l1-1h2v2l-3 2c-3 1-6 3-8 6l-2 3c1 1 0 2-2 2h-5l1-1z" fill="#c2702b"/>
        <path d="M35 14a11 11 0 0 1-2 0l-2-1h-1l-2-1h-3c-2-1-3 0-3 1v4h-5a5 5 0 0 0-3 1c-2 1-3 3-4 6l-1 2-3 1a4 4 0 0 1-2 0H2l-2 1 1 2 2 2 8 3 2 1 5-2 2-2v-1l1-1c1-2 2-4 5-4l7-2 2-3 1-2v-3c1-1 0-2-1-2zM4 29a7 7 0 0 0 3 0l2-1 2-2a42 42 0 0 0 1-3l2-3h2l2-1h5l1-1v-3l1-1 6 1h3l1 1-1 5-2 1-8 3c-2 0-3 2-4 3l-2 3v1l-1 1h-1l-3 1h-1l-8-4-1-1h1z" fill="#f37462"/>
        <path d="m23 19-3 1-5 1h-1v-1c2-2 2-4 2-6v-4l1 1 1 4v2l1 1 4 1zm12-3h-3l-6-1h-1l-1-1h1l1-1h1a3 3 0 0 0 1-1v-1l1-1 1 2v1l1 1 1 1h2l1 1zM3 23l1 3c0 2 2 2 3 3h1v1l-5-1v-6zM17 3l-1 1V3l-1-2 1-1 1 1v2z" fill="#faee3e"/>
        <path d="m16 21 1 2-1 2-2 1v-2l1-2 1-1z" fill="#f6faf1"/>`
    },
    {
        name: 'Three',
        keyword: 'Beacons_3',
        svg: `<path d="m4 17 4 1h5l2 1 3 1 3 2h9l2-1c0-2 1-3 2-2l4 1c1 1 1 3-1 4l-7 3h-2l-5 1c-2 1-4 0-6-1l-6-3h-1l-8-3-1-3 3-1z" opacity=".2"/>
        <path d="m38 17-5 4h-1l-2-1-3 1-5 2h-5l-6-5-4-1-3 1H2v-2l1-1 9-5 2-1 1-1h1v1h2v1l1 1 2 1 1 1 1 1h1l2 1a89 89 0 0 1 8-2h2l3 2v1l-1 1z" fill="#f7aa4c"/>
        <path d="M38 16a5 5 0 0 0-4-3 5 5 0 0 0-2 0h-2l-5 1h-1l-3-1v-1l-2-1-1-1h-2l-2-1h-1l-1 1-6 3H5l-1 1a9 9 0 0 0-1 1v2h3v-1l5-2h3l2 1 2 3 3 3h1l5-3h3l1 1-1 1v1h2l3-3h1c2 0 2-1 2-2zm-6 1h-4l-4 2c-2 0-3 0-4-2l-3-4-2-1h2l2 2a7 7 0 0 0 9 2l3-1h2l1 1-1 2-1-1z" fill="#c2702b"/>
        <path d="m40 17-1-2-3-2a7 7 0 0 0-3 0h-1l-3 1h-4l-2-1-5-4a8 8 0 0 0-6 0l-1 1a48 48 0 0 0-10 6l-1 3c0 1 1 2 2 1l6-2h2l1 1 8 6h3l5-3h6l6-4 1-1zM2 18l1-1 1-1 9-4 1-1h2l3 2 2 2 4 1 2 1 1-1 3-1h4l2 1v1l-1 1h-1l-3 3h-1l-1-1c-1-1-3 0-4 1l-4 2-3-1-6-5-1-1H6l-3 1-1 1z" fill="#f37462"/>
        <path d="m35 15-4 1v-1c2 0 2-1 2-3h1l1 3zm-13 0-3-2-2-1h-2l-2 1h-2l2-1 1-3V7l1-1v2a6 6 0 0 0 1 1v1l1 1 5 4zm0 0zM15 2l-1-1 1-1 1 1-1 1zm7 13z" fill="#faee3e"/>
        <path d="M16 13v2l-2 2-1-1 3-3z" fill="#f9fcf5"/>
        <path d="m29 17 1 1-2 1v-1l1-1z" fill="#f6faf1"/>`
    }
]

module.exports = beacons;