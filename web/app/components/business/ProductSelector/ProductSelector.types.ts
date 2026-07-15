export interface ProductOption {
    id: string;
    sku: string;
    name: string;
    cost: number;
    stock: number;
    minStock: number;
}

export interface ProductSelectorProps {
    options: ProductOption[];
    value: string;
    onChange: (productId: string) => void;
    excludedProductIds?: string[];
    label?: string;
    name?: string;
    placeholder?: string;
    loading?: boolean;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    helperText?: string;
}