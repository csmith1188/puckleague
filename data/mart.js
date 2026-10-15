// All pucks that can be bought at a PokeMart
// cost = rulebook pogs; Adventure Mode charges cost * 100 DigiPogs

const Mart = [
    {
        name: 'Berry',
        ids: [],
        std: false,
        cost: 1,
        notes: []
    },
    {
        name: 'Bike',
        ids: [],
        std: false,
        cost: 10,
        notes: ['Move long action is treated as a normal action while Bike is in your collection.']
    },
    {
        name: 'Energy Puck',
        ids: [],
        std: false,
        cost: 1,
        notes: ['This can be any type of Energy puck the player chooses, if available.']
    },
    {
        name: 'Focus Energy',
        ids: [],
        std: false,
        cost: 2,
        notes: []
    },
    {
        name: 'Full Heal',
        ids: [],
        std: false,
        cost: 1,
        notes: []
    },
    {
        name: 'Great Ball',
        ids: [],
        std: false,
        cost: 8,
        notes: []
    },
    {
        name: 'Heavy Ball',
        ids: [],
        std: false,
        cost: 15,
        notes: []
    },
    {
        name: 'Poké Ball',
        ids: [],
        std: true,
        cost: 5,
        notes: ['Available at every City Zone PokéMart.']
    },
    {
        name: 'Potion',
        ids: [],
        std: true,
        cost: 1,
        notes: ['Available at every City Zone PokéMart.']
    },
    {
        name: 'Power Stone',
        ids: [],
        std: false,
        cost: 3,
        notes: []
    },
    {
        name: 'Switch',
        ids: [],
        std: false,
        cost: 1,
        notes: []
    },
    {
        name: 'Ultra Ball',
        ids: [],
        std: false,
        cost: 11,
        notes: []
    }
];

module.exports = Mart;
