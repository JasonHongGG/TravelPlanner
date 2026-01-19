
export interface PointPackage {
    id: string;
    points: number;
    price: number;
    name: string;
    description: string;
    type?: 'points' | 'subscription';
    popular?: boolean;
}

export const AVAILABLE_PACKAGES: PointPackage[] = [
    {
        id: 'pkg_100',
        points: 100,
        price: 30,
        name: '輕量體驗',
        description: '適合偶爾使用',
        type: 'points'
    },
    {
        id: 'pkg_500',
        points: 500,
        price: 130,
        name: '超值方案',
        popular: true,
        description: '最受歡迎的選擇',
        type: 'points'
    },
    {
        id: 'pkg_1000',
        points: 1000,
        price: 250,
        name: '專業玩家',
        description: '大量生成無壓力',
        type: 'points'
    },
    {
        id: 'plan_unlimited',
        points: 0,
        price: 399,
        name: '旅遊貼身助理',
        description: '無限 AI 生成 + 專屬顧問',
        type: 'subscription'
    }
];
