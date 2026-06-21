// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    address public owner;

    enum JobStatus { Open, Assigned, Completed, Paid, Cancelled }

    struct Job {
        uint256 id;
        uint256 payment;
        address worker;
        JobStatus status;
        bool exists;
    }

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => address[]) public jobApplicants;

    event JobCreated(uint256 indexed jobId, uint256 payment);
    event JobApplied(uint256 indexed jobId, address indexed worker);
    event WorkerApproved(uint256 indexed jobId, address indexed worker);
    event JobCompleted(uint256 indexed jobId, address indexed worker);
    event PaymentReleased(uint256 indexed jobId, address indexed worker, uint256 payment);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createJob(uint256 _jobId) external payable onlyOwner {
        require(!jobs[_jobId].exists, "Job already exists");
        require(msg.value > 0, "Payment must be greater than 0");

        jobs[_jobId] = Job({
            id: _jobId,
            payment: msg.value,
            worker: address(0),
            status: JobStatus.Open,
            exists: true
        });

        emit JobCreated(_jobId, msg.value);
    }

    function applyForJob(uint256 _jobId) external {
        require(jobs[_jobId].exists, "Job does not exist");
        require(jobs[_jobId].status == JobStatus.Open, "Job is not open");
        
        address[] storage applicants = jobApplicants[_jobId];
        for (uint i = 0; i < applicants.length; i++) {
            require(applicants[i] != msg.sender, "Already applied");
        }

        jobApplicants[_jobId].push(msg.sender);
        emit JobApplied(_jobId, msg.sender);
    }

    function approveWorker(uint256 _jobId, address _worker) external onlyOwner {
        require(jobs[_jobId].exists, "Job does not exist");
        require(jobs[_jobId].status == JobStatus.Open, "Job is not open");
        
        jobs[_jobId].worker = _worker;
        jobs[_jobId].status = JobStatus.Assigned;

        emit WorkerApproved(_jobId, _worker);
    }

    function completeJob(uint256 _jobId) external {
        require(jobs[_jobId].exists, "Job does not exist");
        require(jobs[_jobId].status == JobStatus.Assigned, "Job is not assigned");
        require(jobs[_jobId].worker == msg.sender, "Only the assigned worker can complete this job");

        jobs[_jobId].status = JobStatus.Completed;

        emit JobCompleted(_jobId, msg.sender);
    }

    function releasePayment(uint256 _jobId) external onlyOwner {
        require(jobs[_jobId].exists, "Job does not exist");
        require(jobs[_jobId].status == JobStatus.Completed, "Job is not completed");
        
        address worker = jobs[_jobId].worker;
        uint256 payment = jobs[_jobId].payment;

        require(worker != address(0), "No worker assigned");
        require(address(this).balance >= payment, "Insufficient escrow balance");

        jobs[_jobId].status = JobStatus.Paid;

        (bool success, ) = worker.call{value: payment}("");
        require(success, "Transfer failed");

        emit PaymentReleased(_jobId, worker, payment);
    }

    function getApplicants(uint256 _jobId) external view returns (address[] memory) {
        return jobApplicants[_jobId];
    }

    receive() external payable {}
}
