const TSSNode = require('../src/TSSNode');
const { THRESHOLD, TOTAL_PARTICIPANTS } = require('../src/config/config');

async function testTSS() {
    try {
        // Node'ları oluştur
        const node1 = new TSSNode(1, THRESHOLD, TOTAL_PARTICIPANTS);
        const node2 = new TSSNode(2, THRESHOLD, TOTAL_PARTICIPANTS);
        const node3 = new TSSNode(3, THRESHOLD, TOTAL_PARTICIPANTS);

        // DKG Adım 1
        console.log('DKG Step 1 başlatılıyor...');
        const result1 = await node1.dkgStep1();
        const result2 = await node2.dkgStep1();
        const result3 = await node3.dkgStep1();

        // Test mesajını yazdır
        console.log('DKG Step 1 tamamlandı');
        console.log('Node 1 shares:', result1.shares);

        // DKG Adım 2
        console.log('DKG Step 2 başlatılıyor...');
        await node1.dkgStep2(
            [result2.shares[0], result3.shares[0]], 
            [result2.commitment[0], result3.commitment[0]]
        );
        await node2.dkgStep2(
            [result1.shares[1], result3.shares[1]], 
            [result1.commitment[0], result3.commitment[0]]
        );
        await node3.dkgStep2(
            [result1.shares[2], result2.shares[2]], 
            [result1.commitment[0], result2.commitment[0]]
        );

        console.log('DKG Step 2 tamamlandı');

        // İmzalama Testi
        console.log('İmzalama testi başlatılıyor...');
        const message = 'Hello, Threshold Signature!';
        
        // Her düğüm imza payı oluşturur
        const sig1 = await node1.sign(message, [node2, node3]);
        const sig2 = await node2.sign(message, [node1, node3]);
        
        // İmza paylarını birleştir
        const finalSignature = TSSNode.combineSignatures([sig1, sig2]);

        console.log('İmzalama testi tamamlandı');
        console.log('Final Signature:', finalSignature);

        // Doğrulama Kontrolleri
        console.log('Doğrulama kontrolleri yapılıyor...');
        console.log('Node 1 Public Key:', node1.publicKey);
        console.log('Node 2 Public Key:', node2.publicKey);
        console.log('Node 3 Public Key:', node3.publicKey);

    } catch (error) {
        console.error('Test sırasında hata:', error);
    }
}

testTSS();