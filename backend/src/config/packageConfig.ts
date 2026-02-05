export interface PointPackage {
    id: string;
    points: number;
    price: number;
    type?: 'points' | 'subscription';
    popular?: boolean;
}

export const AVAILABLE_PACKAGES: PointPackage[] = [
    {
        id: 'pkg_100',
        points: 100,
        price: 30,
        type: 'points'
    },
    {
        id: 'pkg_500',
        points: 500,
        price: 130,
        popular: true,
        type: 'points'
    },
    {
        id: 'pkg_1000',
        points: 1000,
        price: 250,
        type: 'points'
    },
    {
        id: 'plan_unlimited',
        points: 0,
        price: 399,
        type: 'subscription'
    }
];
