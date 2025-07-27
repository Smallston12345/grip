import { BluetoothLe } from '@capacitor-community/bluetooth-le';

class GripStrengthApp {
    constructor() {
        this.isScanning = false;
        this.foundDevices = new Map();
        this.currentGripDevice = null;
        this.initializeApp();
    }

    async initializeApp() {
        // 綁定按鈕事件
        document.getElementById('scanBtn').addEventListener('click', () => this.startScan());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopScan());
        document.getElementById('permBtn').addEventListener('click', () => this.requestPermissions());

        // 初始化藍牙
        try {
            await BluetoothLe.initialize();
            this.updateStatus('藍牙初始化成功', 'success');
        } catch (error) {
            this.updateStatus('藍牙初始化失敗: ' + error.message, 'error');
        }
    }

    async requestPermissions() {
        try {
            this.updateStatus('正在請求權限...', 'info');
            
            const result = await BluetoothLe.requestPermissions();
            
            if (result.location === 'granted' && result.bluetooth === 'granted') {
                this.updateStatus('權限獲取成功！', 'success');
            } else {
                this.updateStatus('需要藍牙和位置權限才能掃描設備', 'error');
            }
        } catch (error) {
            this.updateStatus('權限請求失敗: ' + error.message, 'error');
        }
    }

    async startScan() {
        if (this.isScanning) return;

        try {
            this.isScanning = true;
            this.updateStatus('正在掃描藍牙設備...', 'info');
            
            // 清空之前的設備列表
            this.foundDevices.clear();
            this.updateDeviceList();

            // 開始掃描
            await BluetoothLe.requestLEScan(
                {
                    allowDuplicates: true,
                    scanMode: 'lowLatency'
                },
                (result) => this.handleScanResult(result)
            );

            // 設定掃描按鈕狀態
            document.getElementById('scanBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;

        } catch (error) {
            this.updateStatus('掃描失敗: ' + error.message, 'error');
            this.isScanning = false;
        }
    }

    async stopScan() {
        if (!this.isScanning) return;

        try {
            await BluetoothLe.stopLEScan();
            this.isScanning = false;
            this.updateStatus(`掃描已停止 (發現 ${this.foundDevices.size} 個設備)`, 'info');
            
            // 重設按鈕狀態
            document.getElementById('scanBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;

        } catch (error) {
            this.updateStatus('停止掃描失敗: ' + error.message, 'error');
        }
    }

    handleScanResult(result) {
        const device = {
            deviceId: result.device.deviceId,
            name: result.device.name || '未知設備',
            rssi: result.rssi,
            timestamp: new Date().toLocaleTimeString()
        };

        // 檢查是否為握力設備
        if (this.isGripDevice(device.name)) {
            device.isGripDevice = true;
            
            // 解析廣播數據中的握力值
            if (result.advertisementData) {
                const gripValue = this.parseGripData(result.advertisementData);
                if (gripValue !== null) {
                    device.gripStrength = gripValue;
                    this.updateGripDisplay(gripValue);
                }
            }
        }

        this.foundDevices.set(device.deviceId, device);
        this.updateDeviceList();
    }

    isGripDevice(deviceName) {
        const gripKeywords = ['握力', 'grip', 'force', 'strength', 'dynamometer'];
        return gripKeywords.some(keyword => 
            deviceName.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    parseGripData(advertisementData) {
        try {
            // 這裡需要根據你的握力設備的具體廣播格式來解析
            // 以下是一個示例，需要根據實際設備調整
            
            if (advertisementData.manufacturerData) {
                const data = new Uint8Array(advertisementData.manufacturerData);
                
                // 假設握力值在廣播數據的第2-3字節 (16位)
                if (data.length >= 4) {
                    const gripValue = (data[2] << 8) | data[3];
                    return gripValue / 10; // 假設需要除以10得到實際值
                }
            }
            
            // 也可能在服務數據中
            if (advertisementData.serviceData) {
                // 根據服務UUID解析數據
                for (const [serviceUuid, data] of Object.entries(advertisementData.serviceData)) {
                    const serviceData = new Uint8Array(data);
                    if (serviceData.length >= 2) {
                        return (serviceData[0] << 8) | serviceData[1];
                    }
                }
            }
            
        } catch (error) {
            console.error('解析握力數據失敗:', error);
        }
        
        return null;
    }

    updateGripDisplay(gripValue) {
        const gripElement = document.getElementById('gripValue');
        gripElement.textContent = `${gripValue.toFixed(1)} kg`;
        
        // 添加動畫效果
        gripElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            gripElement.style.transform = 'scale(1)';
        }, 200);
    }

    updateDeviceList() {
        const deviceList = document.getElementById('deviceList');
        
        if (this.foundDevices.size === 0) {
            deviceList.innerHTML = '<p style="opacity: 0.7;">尚未發現任何設備</p>';
            return;
        }

        let html = '';
        const sortedDevices = Array.from(this.foundDevices.values())
            .sort((a, b) => b.rssi - a.rssi); // 按信號強度排序

        sortedDevices.forEach(device => {
            html += `
                <div class="device-item ${device.isGripDevice ? 'grip-device' : ''}">
                    <div class="device-name">
                        ${device.name} ${device.isGripDevice ? '⭐' : ''}
                    </div>
                    <div style="float: right; font-size: 0.8em; opacity: 0.8;">
                        ${device.timestamp}
                    </div>
                    <div style="clear: both; margin-top: 8px;">
                        信號強度: <span class="rssi">${device.rssi} dBm</span><br>
                        設備ID: ${device.deviceId}
                        ${device.gripStrength ? 
                            `<br>握力值: <strong>${device.gripStrength.toFixed(1)} kg</strong>` : ''
                        }
                    </div>
                </div>
            `;
        });

        deviceList.innerHTML = html;
    }

    updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }
}

// 等待 Capacitor 準備就緒
document.addEventListener('DOMContentLoaded', () => {
    if (window.Capacitor) {
        // 在原生環境中
        new GripStrengthApp();
    } else {
        // 在瀏覽器中顯示提示
        document.getElementById('status').textContent = '請在原生應用中運行以使用藍牙功能';
        document.getElementById('status').className = 'status error';
    }
});
