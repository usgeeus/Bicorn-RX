import { assert, expect } from "chai"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { BigNumberish, Contract, ContractTransactionReceipt, Log } from "ethers"
import { network, ethers, getNamedAccounts } from "hardhat"
import { VDFClaim, TestCase, testCases } from "./testcases"
import { developmentChains, networkConfig } from "../../helper-hardhat-config"
//commitrecover type
import { CommitRecover as CommitRecoverType } from "../../typechain-types"

export const createTestCases = (testcases: any[]) => {
    const result: TestCase[] = []
    testcases.forEach((testcase) => {
        let ts: TestCase
        let setUpProofs: VDFClaim[] = []
        let recoveryProofs: VDFClaim[] = []
        let randomList: bigint[] = []
        let commitList: bigint[] = []
        for (let i = 0; i < (testcase[4] as []).length; i++) {
            setUpProofs.push({
                n: testcase[4][i][0],
                x: testcase[4][i][1],
                y: testcase[4][i][2],
                T: testcase[4][i][3],
                v: testcase[4][i][4],
            })
        }
        for (let i = 0; i < (testcase[9] as []).length; i++) {
            recoveryProofs.push({
                n: testcase[9][i][0],
                x: testcase[9][i][1],
                y: testcase[9][i][2],
                T: testcase[9][i][3],
                v: testcase[9][i][4],
            })
        }
        for (let i = 0; i < (testcase[5] as []).length; i++) {
            randomList.push(testcase[5][i])
        }
        for (let i = 0; i < (testcase[6] as []).length; i++) {
            commitList.push(testcase[6][i])
        }
        result.push({
            n: testcase[0],
            g: testcase[1],
            h: testcase[2],
            T: testcase[3],
            setupProofs: setUpProofs,
            randomList: randomList,
            commitList: commitList,
            omega: testcase[7],
            recoveredOmega: testcase[8],
            recoveryProofs: recoveryProofs,
        })
    })
    return result
}


export const deployCommitRevealContract = async (params : any, deployer:SignerWithAddress) => {
    let commitRecover = await ethers.deployContract("CommitRecover", [])
    commitRecover = await commitRecover.waitForDeployment()
    const tx = commitRecover.deploymentTransaction()
    await tx?.wait()
    const startTx = await (commitRecover.connect(deployer) as CommitRecoverType).start(...params)
    const receipt = await startTx.wait()
    console.log("deploy gas used: ", receipt?.gasUsed?.toString())
    return { commitRecover, receipt }
}

export const deployFirstTestCaseCommitRevealContract = async () => {
    const deployer = await ethers.getSigner((await getNamedAccounts()).deployer)
    const testcases = createTestCases(testCases)
    const testcaseNum = 0
    let params = [networkConfig[network.config.chainId!].commitDuration, networkConfig[network.config.chainId!].commitRevealDuration, testcases[testcaseNum].n, deployer.address, testcases[testcaseNum].setupProofs]
     const { commitRecover, receipt } = await deployCommitRevealContract(params, deployer)
    //get states
    const {
        stage,
        commitStartTime,
        commitDuration,
        commitRevealDuration,
        n,
        g,
        h,
        T,
        round,
        deployedEvent,
        deployedBlockNum,
        deployedTimestamp,
    } = await getStatesAfterDeployment(commitRecover, receipt as ContractTransactionReceipt)
    //return states
    return {
        commitRecover,
        receipt,
        testcases,
        params,
        stage,
        commitStartTime,
        commitDuration,
        commitRevealDuration,
        n,
        g,
        h,
        T,
        round,
        deployedEvent,
        deployedBlockNum,
        deployedTimestamp,
    }
}

export const getStatesAfterDeployment = async (
    commitRevealContract : any,
    receipt: ContractTransactionReceipt,
) => {
    // contract states
    const stage = await commitRevealContract.stage()
    const commitStartTime = await commitRevealContract.startTime()
    const commitDuration = await commitRevealContract.commitDuration()
    const commitRevealDuration = await commitRevealContract.commitRevealDuration()
    const round = await commitRevealContract.round()
    console.log("round", round)
    const valuesAtRound = await commitRevealContract.valuesAtRound(round)
    const n = valuesAtRound.n
    const g = valuesAtRound.g
    const h = valuesAtRound.h
    const T = valuesAtRound.T

    // event
    const topic = commitRevealContract.interface.getEvent("Start")
    const log = receipt.logs.find((x) => x.topics.indexOf(topic?.topicHash!) >= 0)
    const deployedEvent = commitRevealContract.interface.parseLog({
        topics: log?.topics! as string[],
        data: log?.data!,
    })

    // others
    const deployedBlockNum = receipt.blockNumber
    const deployedBlock = await ethers.provider.getBlock(deployedBlockNum)
    const deployedTimestamp = deployedBlock?.timestamp

    return {
        stage,
        commitStartTime,
        commitDuration,
        commitRevealDuration,
        n,
        g,
        h,
        T,
        round,
        deployedEvent,
        deployedBlockNum,
        deployedTimestamp,
    }
}

export const initializedContractCorrectly = async (
    commitRevealContract: any,
    receipt: ContractTransactionReceipt,
    testcase: TestCase,
) => {
    const {
        stage,
        commitStartTime,
        commitDuration,
        commitRevealDuration,
        n,
        g,
        h,
        T,
        round,
        deployedEvent,
        deployedBlockNum,
        deployedTimestamp,
    } = await getStatesAfterDeployment(commitRevealContract, receipt)

    assert.equal(
        commitStartTime,
        deployedTimestamp,
        "commitStartTime should be equal to deployedTimestamp",
    )
    assert.equal(commitStartTime, deployedEvent!.args?.startTime)
    assert.equal(stage, 0, "stage should be 0")
    assert.equal(
        commitDuration,
        networkConfig[network.config.chainId!].commitDuration,
        "commitDuration should be equal to networkConfig",
    )
    assert.equal(
        commitDuration,
        deployedEvent!.args?.commitDuration,
        "commitDuration should be equal to deployedEvent",
    )
    assert.equal(commitRevealDuration, networkConfig[network.config.chainId!].commitRevealDuration)
    assert.equal(
        commitRevealDuration,
        deployedEvent!.args?.commitRevealDuration,
        "commitRevealDuration should be equal to deployedEvent",
    )
    assert.isAbove(
        commitRevealDuration,
        commitDuration,
        "commitRevealDuration should be greater than commitDuration",
    )
    assert.equal(n, deployedEvent!.args?.n, "n should be equal to deployedEvent")
    assert.equal(n, testcase.n, "n should be equal to testcase")
    assert.equal(g, deployedEvent!.args?.g, "g should be equal to deployedEvent")
    assert.equal(g, testcase.g, "g should be equal to testcase")
    assert.equal(T, deployedEvent!.args?.T, "T should be equal to deployedEvent")
    assert.equal(T, testcase.T, "T should be equal to testcase")
    assert.equal(h, deployedEvent!.args?.h, "h should be equal to deployedEvent")
    assert.equal(h, testcase.h, "h should be equal to testcase")
    assert.equal(round, 1, "round should be 1")
    assert.equal(round, deployedEvent!.args?.round, "round should be equal to deployedEvent")
}

export const commit = async (
    commitRecoverContract: any,
    signer: SignerWithAddress,
    commit: BigNumberish,
    i: number,
    round: number,
) => {
    const tx = await (commitRecoverContract.connect(signer) as Contract).commit(commit, signer.address)
    const receipt = await tx.wait()
    await commitCheck(commitRecoverContract, receipt, commit, signer, i, round)
}

export const reveal = async (
    commitRecoverContract: any,
    signer: SignerWithAddress,
    random: BigNumberish,
    i: number,
    round: number,
) => {
    const tx = await (commitRecoverContract.connect(signer) as Contract).reveal(random, signer.address)
    const receipt = await tx.wait()
    await revealCheck(commitRecoverContract, receipt, random, signer, i, round)
}

interface CommitRevealValue {
    c: BigNumberish
    a: BigNumberish
    participantAddress: string
}
interface UserAtRound {
    index: BigNumberish
    committed: boolean
    revealed: boolean
}

export const getStatesAfterCommitOrReveal = async (
    commitRevealContract: Contract,
    receipt: ContractTransactionReceipt,
    signer: SignerWithAddress,
    i: number,
) => {
    //contract states
    const count = await commitRevealContract.count()
    const stage = await commitRevealContract.stage()
    const commitsString = await commitRevealContract.commitsString()
    const round = await commitRevealContract.round()
    const valuesAtRound = await commitRevealContract.valuesAtRound(round)
    const userInfosAtRound: UserAtRound = await commitRevealContract.userInfosAtRound(
        signer.address,
        round,
    )
    const commitRevealValue: CommitRevealValue = await commitRevealContract.commitRevealValues(
        round,
        i,
    )
    return {
        count,
        stage,
        commitsString,
        round,
        valuesAtRound,
        userInfosAtRound,
        commitRevealValue,
    }
}

export const revealCheck = async (
    commitRevealContract: Contract,
    receipt: ContractTransactionReceipt,
    random: BigNumberish,
    signer: SignerWithAddress,
    i: number,
    roundTest: number,
) => {
    const ii = ethers.toBigInt(i)
    //get states
    const {
        count,
        stage,
        commitsString,
        round,
        valuesAtRound,
        userInfosAtRound,
        commitRevealValue,
    } = await getStatesAfterCommitOrReveal(commitRevealContract, receipt, signer, i)
    //console.log("valuesAtRoundvaluesAtRound, ", valuesAtRound)
    const { omega, bStar, numOfParticipants, isCompleted } = valuesAtRound
}

let commitsStringTest: string
export const commitCheck = async (
    commitRevealContract: Contract,
    receipt: ContractTransactionReceipt,
    commit: BigNumberish,
    signer: SignerWithAddress,
    i: number,
    roundTest: number,
) => {
    //if (i == 0) commitsStringTest = ""
    const ii = ethers.toBigInt(i)
    //get states
    const {
        count,
        stage,
        commitsString,
        round,
        valuesAtRound,
        userInfosAtRound,
        commitRevealValue,
    } = await getStatesAfterCommitOrReveal(commitRevealContract, receipt, signer, i)
    //assert.equal(ii + BigInt(1), count, "count should be equal to i")
    assert.equal(stage, 0, "stage should be 0")
    assert.equal(round, 1, "round should be 1")
    // commitsStringTest += commit.toString()
    // assert.equal(
    //     commitsStringTest,
    //     commitsString,
    //     "commitsString should be equal to commitsStringTest",
    // )
    assert.equal(roundTest, round, "round should be equal to roundTest")
    const { omega, bStar, numOfParticipants, isCompleted } = valuesAtRound
    assert.equal(omega, 0, "omega should be 0")
    assert.equal(bStar, 0, "bStar should be 0")
    assert.equal(numOfParticipants, 0, "numOfParticipants should be 0")
    assert.equal(isCompleted, false, "isCompleted should be false")
    const { index, committed, revealed } = userInfosAtRound
    //assert.equal(index, ii, "index should be equal to i")
    assert.equal(committed, true, "committed should be true")
    assert.equal(revealed, false, "revealed should be false")
//     assert.equal(commitRevealValue.c, commit, "commitRevealValue.c should be equal to commit")
//     assert.equal(commitRevealValue.participantAddress, signer.address)
//     assert.equal(commitRevealValue.a, 0, "commitRevealValue.a should be 0")
 }
