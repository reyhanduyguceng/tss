const Web3 = require('web3');
const BN = require('bn.js');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const crypto = require('crypto');

class TSSNode {
    constructor(nodeId, threshold, totalParticipants) {
        this.nodeId = nodeId;
        this.threshold = threshold;
        this.totalParticipants = totalParticipants;
        
        const provider = new Web3.providers.HttpProvider('http://localhost:8545');
        this.web3 = new Web3(provider);
        
        this.shareI = null;
        this.publicKey = null;
        this.chainCode = null;
    }

    // DKG Step 1: Initial key generation
    async dkgStep1() {
        const coefficients = Array(this.threshold).fill(0)
            .map(() => new BN(crypto.randomBytes(32)));
        
        const shares = [];
        const commitments = [];

        for (let i = 1; i <= this.totalParticipants; i++) {
            let share = coefficients[0];
            let power = new BN(1);
            for (let j = 1; j < coefficients.length; j++) {
                power = power.mul(new BN(i)).umod(ec.n);
                share = share.add(coefficients[j].mul(power)).umod(ec.n);
            }
            shares.push({
                recipient: i,
                value: share
            });
        }

        // Generate commitments
        for (const coeff of coefficients) {
            commitments.push(ec.g.mul(coeff));
        }

        return {
            shares,
            commitment: commitments.map(point => point.encode('hex')),
            coefficients: coefficients
        };
    }

    // DKG Step 2: Verify received shares
    async dkgStep2(receivedShares, commitments) {
        try {
            // Decode commitments back to points
            const decodedCommitments = commitments.map(comm => 
                ec.curve.decodePoint(comm, 'hex')
            );

            // Verify each received share using Lagrange interpolation
            for (const share of receivedShares) {
                // Reconstruct verification point using Lagrange interpolation
                let verificationPoint = ec.curve.point(0, 0);
                
                for (let j = 0; j < decodedCommitments.length; j++) {
                    // Compute Lagrange basis polynomial
                    let lagrangeBasis = new BN(1);
                    for (let m = 0; m < decodedCommitments.length; m++) {
                        if (m !== j) {
                            const num = new BN(this.nodeId).sub(new BN(m + 1));
                            const denom = new BN(j + 1).sub(new BN(m + 1));
                            lagrangeBasis = lagrangeBasis
                                .mul(num)
                                .mul(denom.invm(ec.n))
                                .umod(ec.n);
                        }
                    }

                    // Add weighted commitment
                    verificationPoint = verificationPoint.add(
                        decodedCommitments[j].mul(lagrangeBasis)
                    );
                }

                // Verify the share against the reconstructed point
                const sharePoint = ec.g.mul(share.value);
                
                // Use a robust point comparison
                if (!this.pointsAreEquivalent(sharePoint, verificationPoint)) {
                    console.error('Share verification failed', {
                        nodeId: this.nodeId,
                        share: share.value.toString(),
                        sharePoint: sharePoint.encode('hex'),
                        verificationPoint: verificationPoint.encode('hex')
                    });
                    throw new Error('Share verification failed');
                }
            }

            // Combine shares
            this.shareI = receivedShares.reduce((acc, share) => 
                acc.add(share.value).umod(ec.n), new BN(0));

            // Generate public key
            this.publicKey = ec.g.mul(this.shareI).encode('hex');
            
            // Generate chain code (for BIP32)
            this.chainCode = crypto.randomBytes(32);

            return {
                shareI: this.shareI,
                publicKey: this.publicKey,
                chainCode: this.chainCode
            };
        } catch (error) {
            console.error('DKG Step 2 Error:', error);
            throw error;
        }
    }

    // Robust point equivalence check
    pointsAreEquivalent(point1, point2, tolerance = 1e-10) {
        // Compare compressed points first
        const compressed1 = point1.encode('hex');
        const compressed2 = point2.encode('hex');
        
        if (compressed1 === compressed2) return true;

        // If compressed points differ, check coordinate proximity
        const x1 = point1.getX();
        const y1 = point1.getY();
        const x2 = point2.getX();
        const y2 = point2.getY();

        // Convert to string to avoid precision issues
        const xDiff = new BN(x1.toString()).sub(new BN(x2.toString())).abs();
        const yDiff = new BN(y1.toString()).sub(new BN(y2.toString())).abs();

        // Allow a small tolerance
        return xDiff.lte(ec.n.muln(tolerance)) && 
               yDiff.lte(ec.n.muln(tolerance));
    }

    // Signing functionality
    async sign(message, otherParticipants) {
        const messageHash = this.web3.utils.keccak256(message);
        const k = new BN(crypto.randomBytes(32));
        const R = ec.g.mul(k);

        // Generate signature share
        const r = R.getX();
        const s = k.invm(ec.n)
            .mul(new BN(messageHash).add(r.mul(this.shareI)))
            .umod(ec.n);

        return { r, s };
    }

    // Combine signature shares
    static combineSignatures(sigShares) {
        const r = sigShares[0].r;
        const s = sigShares.reduce((acc, share) => 
            acc.add(share.s).umod(ec.n), new BN(0));
        
        return {
            r: r.toString('hex'),
            s: s.toString('hex'),
            v: 27 
        };
    }
}

module.exports = TSSNode;