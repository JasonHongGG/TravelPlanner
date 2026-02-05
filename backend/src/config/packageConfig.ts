export interface PointPackage {
    id: string;
    points: number;
    price: number;
    type?: 'points' | 'subscription';
    popular?: boolean;
    name: string;
    description: string;
}

export const AVAILABLE_PACKAGES: PointPackage[] = [
    {
        id: 'pkg_100',
        points: 100,
        price: 30,
        type: 'points',
        name: '100 點',
        description: '適合小額體驗 AI 功能'
    },
    {
        id: 'pkg_500',
        points: 500,
        price: 130,
        popular: true,
        type: 'points',
        name: '500 點',
        description: '最受歡迎的點數方案'
    },
    {
        id: 'pkg_1000',
        points: 1000,
        price: 250,
        type: 'points',
        name: '1000 點',
        description: '高用量推薦，單點成本更划算'
    },
    {
        id: 'plan_unlimited',
        points: 0,
        price: 399,
        type: 'subscription',
        name: '無限會員',
        description: '訂閱期間內享會員功能與指定服務免費'
    }
];
