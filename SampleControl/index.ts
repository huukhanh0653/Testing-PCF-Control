import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class FastScannerControl implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    // Các biến tham chiếu nội bộ (Tránh dùng document.getElementById)
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _container: HTMLDivElement;
    private _inputElement: HTMLInputElement;

    // Biến lưu trữ giá trị hiện tại để so sánh (tránh infinite loop)
    private _currentValue: string | null;

    // Lưu tham chiếu của các Event Listener để gỡ bỏ trong hàm destroy
    private _onKeyDownBound: EventListener;
    private _onBlurBound: EventListener;

    constructor() { }

    /**
     * Khởi tạo Control. Chạy 1 lần duy nhất.
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = container;

        // 1. Khởi tạo thẻ HTML an toàn (Không cấp phát ID tĩnh)
        this._inputElement = document.createElement("input");
        this._inputElement.setAttribute("type", "text");
        this._inputElement.setAttribute("class", "fast-scanner-input");
        // Đặt placeholder để UX thân thiện hơn
        this._inputElement.setAttribute("placeholder", "Bóp cò để quét mã...");

        // 2. Bind ngữ cảnh (this) cho các hàm xử lý sự kiện
        this._onKeyDownBound = this.onKeyDown.bind(this) as EventListener;
        this._onBlurBound = this.onBlur.bind(this) as EventListener;

        // 3. Gắn Event Listeners trực tiếp vào tham chiếu đối tượng
        // Bắt sự kiện Enter từ phần cứng máy scan
        this._inputElement.addEventListener("keydown", this._onKeyDownBound);
        // Fallback: Bắt sự kiện khi người dùng gõ tay và bấm ra ngoài
        this._inputElement.addEventListener("blur", this._onBlurBound);

        // Nhúng thẻ input vào không gian của Form
        this._container.appendChild(this._inputElement);

        // // 4. Kỹ thuật Auto-focus cho máy scan chuyên dụng
        // // Sử dụng setTimeout để đảm bảo DOM của Form đã hoàn tất quá trình render
        // setTimeout(() => {
        //     if (this._inputElement) {
        //         this._inputElement.focus();
        //     }
        // }, 300); 
    }

    /**
     * Hàm gọi khi có dữ liệu từ Dataverse đẩy xuống hoặc trạng thái Form thay đổi.
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;

        // 1. Quản lý trạng thái Form (Read-only / Disabled)
        let isReadOnly = context.mode.isControlDisabled || context.mode.isVisible === false;
        this._inputElement.disabled = isReadOnly;

        // 2. Lấy giá trị thô từ Dataverse
        // (Giả định trong Manifest bạn đặt tên property là 'inputValue')
        let newValue = context.parameters.inputValue.raw;

        // 3. Cập nhật DOM thông minh (Chỉ vẽ lại nếu dữ liệu THỰC SỰ thay đổi)
        if (this._currentValue !== newValue) {
            this._currentValue = newValue;
            this._inputElement.value = newValue ? newValue : "";
        }
    }

    /**
     * Hàm trả dữ liệu về lại cho Dataverse để lưu trữ.
     */
    public getOutputs(): IOutputs {
        return {
            inputValue: this._currentValue !== null ? this._currentValue : undefined
        };
    }

    /**
     * Dọn dẹp tài nguyên khi người dùng đóng Form. (Chống Memory Leak)
     */
    public destroy(): void {
        // BẮT BUỘC: Gỡ bỏ tất cả các event listener đã đăng ký
        if (this._inputElement) {
            this._inputElement.removeEventListener("keydown", this._onKeyDownBound);
            this._inputElement.removeEventListener("blur", this._onBlurBound);
        }
    }

    // ==========================================
    // CÁC HÀM XỬ LÝ SỰ KIỆN (EVENT HANDLERS)
    // ==========================================

    /**
     * Xử lý luồng Keystroke Injection từ máy scan
     */
    private onKeyDown(event: KeyboardEvent): void {
        // Máy scan luôn bắn phím Enter ở cuối chuỗi mã vạch
        if (event.key === "Enter") {
            // Ngăn chặn trình duyệt tự động submit form (hành vi mặc định của phím Enter)
            event.preventDefault();

            this.commitData();

            // Tính năng nâng cao: Tự động bôi đen toàn bộ text cũ 
            // để lần bóp cò tiếp theo sẽ ghi đè mã mới lên ngay lập tức
            this._inputElement.select();
        }
    }

    /**
     * Xử lý khi người dùng gõ tay thủ công (không dùng súng scan)
     */
    private onBlur(event: Event): void {
        this.commitData();
    }

    /**
     * Cập nhật giá trị vào biến và thông báo cho hệ thống
     */
    private commitData(): void {
        let inputValue = this._inputElement.value;

        // Chuẩn hóa dữ liệu: Nếu null/undefined thì quy về chuỗi rỗng
        let normalizedCurrent = this._currentValue ? this._currentValue : "";
        let normalizedInput = inputValue ? inputValue : "";

        // Chỉ notify nếu dữ liệu THỰC SỰ khác biệt
        if (normalizedCurrent !== normalizedInput) {
            this._currentValue = inputValue;
            this._notifyOutputChanged();
        }
    }
}