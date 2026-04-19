// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SafeTrackEscrow {
    enum Status {
        None,
        Registered,
        Monitoring,
        Anchored,
        Claimable,
        Released
    }

    struct Shipment {
        bool exists;
        address consignee;
        uint16 riskThresholdBps;
        uint16 riskScoreBps;
        uint64 latestGForceMilli;
        bool tamperDetected;
        bytes32 evidenceRoot;
        string evidenceUri;
        Status status;
        uint64 updatedAt;
    }

    mapping(bytes32 => Shipment) private shipments;

    event ShipmentRegistered(string shipmentId, address consignee, uint16 riskThresholdBps);
    event TelemetrySynced(string shipmentId, uint64 latestGForceMilli, uint16 riskScoreBps, bool tamperDetected);
    event EvidenceAnchored(string shipmentId, bytes32 evidenceRoot, string evidenceUri);
    event EscrowReleased(string shipmentId, address consignee);

    function shipmentKey(string memory shipmentId) public pure returns (bytes32) {
        return keccak256(bytes(shipmentId));
    }

    function registerShipment(
        string calldata shipmentId,
        address consignee,
        uint16 riskThresholdBps
    ) external {
        require(consignee != address(0), "Invalid consignee");

        bytes32 key = shipmentKey(shipmentId);
        Shipment storage item = shipments[key];
        item.exists = true;
        item.consignee = consignee;
        item.riskThresholdBps = riskThresholdBps;
        item.status = Status.Registered;
        item.updatedAt = uint64(block.timestamp);

        emit ShipmentRegistered(shipmentId, consignee, riskThresholdBps);
    }

    function syncTelemetry(
        string calldata shipmentId,
        uint256 latestGForceMilli,
        uint16 riskScoreBps,
        bool tamperDetected
    ) external {
        Shipment storage item = shipments[shipmentKey(shipmentId)];
        require(item.exists, "Shipment missing");

        item.latestGForceMilli = uint64(latestGForceMilli);
        item.riskScoreBps = riskScoreBps;
        item.tamperDetected = tamperDetected;
        item.status = riskScoreBps >= item.riskThresholdBps || tamperDetected
            ? Status.Claimable
            : Status.Monitoring;
        item.updatedAt = uint64(block.timestamp);

        emit TelemetrySynced(shipmentId, uint64(latestGForceMilli), riskScoreBps, tamperDetected);
    }

    function anchorEvidence(
        string calldata shipmentId,
        bytes32 evidenceRoot,
        string calldata evidenceUri
    ) external {
        Shipment storage item = shipments[shipmentKey(shipmentId)];
        require(item.exists, "Shipment missing");
        require(evidenceRoot != bytes32(0), "Empty evidence root");

        item.evidenceRoot = evidenceRoot;
        item.evidenceUri = evidenceUri;
        item.status = item.status == Status.Claimable ? Status.Claimable : Status.Anchored;
        item.updatedAt = uint64(block.timestamp);

        emit EvidenceAnchored(shipmentId, evidenceRoot, evidenceUri);
    }

    function validateClaimRules(string calldata shipmentId) external view returns (bool claimable, string memory reason) {
        Shipment storage item = shipments[shipmentKey(shipmentId)];
        if (!item.exists) {
            return (false, "Shipment missing");
        }
        if (item.evidenceRoot == bytes32(0)) {
            return (false, "Evidence missing");
        }
        if (item.riskScoreBps < item.riskThresholdBps && !item.tamperDetected) {
            return (false, "Risk threshold not met");
        }
        return (true, "Claimable");
    }

    function releaseEscrow(string calldata shipmentId) external {
        Shipment storage item = shipments[shipmentKey(shipmentId)];
        require(item.exists, "Shipment missing");
        require(item.evidenceRoot != bytes32(0), "Evidence missing");
        require(item.riskScoreBps >= item.riskThresholdBps || item.tamperDetected, "Threshold not met");

        item.status = Status.Released;
        item.updatedAt = uint64(block.timestamp);

        emit EscrowReleased(shipmentId, item.consignee);
    }

    function getShipmentSnapshot(
        string calldata shipmentId
    )
        external
        view
        returns (
            bool exists,
            uint8 status,
            uint16 riskThresholdBps,
            uint16 riskScoreBps,
            uint64 latestGForceMilli,
            bool tamperDetected,
            bytes32 evidenceRoot,
            string memory evidenceUri,
            uint64 updatedAt
        )
    {
        Shipment storage item = shipments[shipmentKey(shipmentId)];
        return (
            item.exists,
            uint8(item.status),
            item.riskThresholdBps,
            item.riskScoreBps,
            item.latestGForceMilli,
            item.tamperDetected,
            item.evidenceRoot,
            item.evidenceUri,
            item.updatedAt
        );
    }
}
