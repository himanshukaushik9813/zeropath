pragma circom 2.1.8;

include "circomlib/circuits/poseidon.circom";

template MerklePath(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    signal current[levels + 1];
    signal selector[levels];
    current[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);

        // Mux: if pathIndices[i]==0 => left=current, right=sibling
        //       if pathIndices[i]==1 => left=sibling, right=current
        selector[i] <== pathIndices[i] * (pathElements[i] - current[i]);
        hashers[i].inputs[0] <== current[i] + selector[i];
        hashers[i].inputs[1] <== pathElements[i] - selector[i];
        current[i + 1] <== hashers[i].out;
    }

    root <== current[levels];
}

template PrivateSettlement(levels) {
    // Public inputs
    signal input batch_root;
    signal input source_event_root;
    signal input nullifier_hash;
    signal input destination_commitment;
    signal input asset_id;
    signal input epoch;

    // Private inputs
    signal input secret;
    signal input amount;
    signal input route_salt;
    signal input receiver_view_key;
    signal input source_event_path[levels];
    signal input source_event_indices[levels];
    signal input batch_path[levels];
    signal input batch_indices[levels];

    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== 1;
    nullifier_hash === nullifierHasher.out;

    component destinationHasher = Poseidon(3);
    destinationHasher.inputs[0] <== receiver_view_key;
    destinationHasher.inputs[1] <== secret;
    destinationHasher.inputs[2] <== route_salt;
    destination_commitment === destinationHasher.out;

    component sourceLeafHasher = Poseidon(5);
    sourceLeafHasher.inputs[0] <== secret;
    sourceLeafHasher.inputs[1] <== amount;
    sourceLeafHasher.inputs[2] <== asset_id;
    sourceLeafHasher.inputs[3] <== destination_commitment;
    sourceLeafHasher.inputs[4] <== route_salt;

    component sourcePath = MerklePath(levels);
    sourcePath.leaf <== sourceLeafHasher.out;
    for (var i = 0; i < levels; i++) {
        sourcePath.pathElements[i] <== source_event_path[i];
        sourcePath.pathIndices[i] <== source_event_indices[i];
    }
    source_event_root === sourcePath.root;

    component batchLeafHasher = Poseidon(5);
    batchLeafHasher.inputs[0] <== nullifier_hash;
    batchLeafHasher.inputs[1] <== destination_commitment;
    batchLeafHasher.inputs[2] <== asset_id;
    batchLeafHasher.inputs[3] <== epoch;
    batchLeafHasher.inputs[4] <== amount;

    component batchPath = MerklePath(levels);
    batchPath.leaf <== batchLeafHasher.out;
    for (var j = 0; j < levels; j++) {
        batchPath.pathElements[j] <== batch_path[j];
        batchPath.pathIndices[j] <== batch_indices[j];
    }
    batch_root === batchPath.root;
}

component main { public [batch_root, source_event_root, nullifier_hash, destination_commitment, asset_id, epoch] } =
    PrivateSettlement(32);
