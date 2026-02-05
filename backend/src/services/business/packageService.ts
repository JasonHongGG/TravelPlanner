import { AVAILABLE_PACKAGES } from "../../config/packageConfig";

export class PackageService {
    list() {
        return AVAILABLE_PACKAGES;
    }
}

export const packageService = new PackageService();
